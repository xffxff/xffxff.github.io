---
title: "Salsa: LRU needs keep dependency info"
date: "2022-08-23"
---

reivew [#371] 加深了我对 salsa 做 recomputation 的理解。

<!-- more -->

我们先来看一个测试，思考这个测试能否 pass  

```rust
#[salsa::tracked(jar = Jar, lru = 3)]
fn get_hot_potato(db: &dyn Db, input: MyInput) -> Arc<HotPotato> {
    db.push_log(format!("get_hot_potato({:?})", input.field(db)));
    Arc::new(HotPotato::new(input.field(db)))
}

#[salsa::tracked(jar = Jar)]
fn get_hot_potato2(db: &dyn Db, input: MyInput) -> u32 {
    db.push_log(format!("get_hot_potato2({:?})", input.field(db)));
    get_hot_potato(db, input).0
}

#[test]
fn lru_keeps_dependency_info() {
    let mut db = Database::default();
    let capacity = 3;

    // Invoke `get_hot_potato2` 33 times. This will (in turn) invoke
    // `get_hot_potato`, which will trigger LRU after 32 executions.
    let inputs: Vec<MyInput> = (0..(capacity + 1))
        .map(|i| MyInput::new(&mut db, i as u32))
        .collect();

    for (i, input) in inputs.iter().enumerate() {
        let x = get_hot_potato2(&db, *input);
        assert_eq!(x as usize, i);
    }

    db.salsa_runtime_mut()
        .synthetic_write(salsa::Durability::HIGH);

    // We want to test that calls to `get_hot_potato2` are still considered
    // clean. Check that no new executions occur as we go here.
    db.assert_logs_len((capacity + 1) * 2);

    // calling `get_hot_potato2(0)` has to check that `get_hot_potato(0)` is still valid;
    // even though we've evicted it (LRU), we find that it is still good
    let p = get_hot_potato2(&db, *inputs.first().unwrap());
    assert_eq!(p, 0);
    db.assert_logs_len(0);
}
```

这个测试是要做什么？  

为了方便，将 `get_hot_potato` 记为 `get`，`get_hot_potato2` 记为 `get2`。  

我们有两个 tracked function：`get` 和 `get2`，不用关心这两个 function 做了啥，只需要知道
`get2` 调用了 `get`，也就是说 `get2` 依赖 `get` 的结果。另一个需要注意的点是 `get` 设置了 `lru = 3`，而 `get2` 没有设置 lru。  

现在调用 get2 四次，来看看 salsa 内部的状态，`get` 并没有存储 input 为 0 的结果，因为它设置了
`lru = 3`，input 为 0 的结果被 evict 了。  

```
+-------+----------------+-----------------+
| input |       get      |       get2      |
+-------+----------------+-----------------+
|   0   |                |        0        |
+-------+----------------+-----------------+
|   1   |        1       |        1        |
+-------+----------------+-----------------+
|   2   |        2       |        2        |
+-------+----------------+-----------------+
|   3   |        3       |        3        |
+-------+----------------+-----------------+
```

我们现在调用 `get2(0)`（这里应该写 `input0` 会比较好，`input0 = MyInput::new(&mut db, 0)`，但为了简单就写了 0），
能直接用 salsa 存储的结果吗？还需要重新计算吗？显然不用，不是存储有吗？那如果现在有别的输入改变了 salsa 的 `current_revision` 呢? 
`synthetic_write` 就是在做这件事。也就是说 salsa 的 `current_revision` 大于 `get` 和 `get2` 结果被 verify 
的 revision。这意味着 [shallow_verify_memo] 不能确定 `get2(0)` 的结果是否能用，得让 [deep_verify_memo]
去进一步判断。`deep_verify_memo` 会检查 `get2(0)` 依赖的其他计算结果有没有改变，所以会去查看 `get(0)`，
发现压根儿没有存储 `get(0)` 的结果，当然也没法判断它有没有改变，只能保守地认为发生了改变，所以 `get2(0)` 和
`get(0)` 都会重新计算。  

[shallow_verify_memo]: https://github.com/salsa-rs/salsa/blob/d3f0077d212d76ae81e6df0b7614ece9df469ed0/components/salsa-2022/src/function/maybe_changed_after.rs#L107-L135
[deep_verify_memo]: https://github.com/salsa-rs/salsa/blob/d3f0077d212d76ae81e6df0b7614ece9df469ed0/components/salsa-2022/src/function/maybe_changed_after.rs#L145-L202  

显然，这不够好，实际上 `get2(0)` 的结果是可以重用的，因为 `get(0)` 的结果虽然被 evict 了，但并没有发生改变。
**在我们这个场景下，`get2(0)` 并不关心 `get(0)` 的结果是多少，只关心从它上次被 verify 后有没有发生改变**。  

有没有方法去优化它呢？[#371] 提供了一种解决方案。我们 evict 的时候，不再直接删除整个 `Memo`，只是把 `Memo.value` 设置为 `None`，保留
`verified_at` 和 `revisions`。  

```rust
/// Evicts the existing memo for the given key, replacing it
/// with an equivalent memo that has no value. If the memo is untracked, BaseInput, 
/// or has values assigned as output of another query, this has no effect.
pub(super) fn evict(&self, key: K) {
    use dashmap::mapref::entry::Entry::*;
    use crate::runtime::local_state::QueryOrigin;

    if let Occupied(entry )=  self.map.entry(key) {
        let memo = entry.get().load();
        match memo.revisions.origin {
            QueryOrigin::Assigned(_)
            | QueryOrigin::DerivedUntracked(_)
            | QueryOrigin::BaseInput
            | QueryOrigin::Field => {
                // Careful: Cannot evict memos whose values were
                // assigned as output of another query
                // or those with untracked inputs
                // as their values cannot be reconstructed.
                return;
            },
            
            QueryOrigin::Derived(_) => {
                let memo_evicted = Arc::new(Memo::new(
                    None::<V>,
                    memo.verified_at.load(),
                    memo.revisions.clone(),
                ));

                entry.get().store(memo_evicted);
            }
        }
    }
}
```

[#371]: https://github.com/salsa-rs/salsa/pull/371