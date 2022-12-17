---
title: "Rust Analyzer: 为什么要跑 cargo check"
date: "2022-06-04"
---

为什么每次编辑的时候（严格来说是保存文本的时候），RA 都要跑一遍 `cargo check` ？记得有朋友抱怨说跑 `cargo check` 时 ide 很卡，编辑体验很不好，总不能做一件吃力不讨好的事情吧。

![](/11/status_bar.png) 

原因就是 `cargo check` 的报错信息对 RA 非常有用，这些报错信息是 RA diagnostics 的重要部分。

![](/11/vscode.png)  

图中代码 `main` 函数少了 } ， RA 提示我们有一些错误，其中 `this file contains an unclosed delimiter` 和 `main.rs(1, 11) unclosed delimiter 是 cargo check` 给出的，`Syntax Error: expected R_CURLY` 是 RA 给出的。

整体思路其实挺简单的，起一个线程跑 cargo check --message-format=json ，这个命令会将报错信息以 json 的格式输出，我贴了一段在下面，它包含具体的报错信息（rendered 和 message 字段），错误的级别（level 字段，error or warning）， 错误发生的位置（spans 字段）。有了这些信息后，RA 就可以把它们展示在 ide 界面上。

```json
"message": {
    "rendered": "error: this file contains an unclosed delimiter\n --> src/main.rs:2:31\n  |\n1 | fn main() {\n  |           - unclosed delimiter\n2 |     println!(\"Hello World!\");\n  |                               ^\n\n",
    "children": [],
    "code": null,
    "level": "error",
    "message": "this file contains an unclosed delimiter",
    "spans": [
      {
        "byte_end": 11,
        "byte_start": 10,
        "column_end": 12,
        "column_start": 11,
        "expansion": null,
        "file_name": "src/main.rs",
        "is_primary": false,
        "label": "unclosed delimiter",
        "line_end": 1,
        "line_start": 1,
        "suggested_replacement": null,
        "suggestion_applicability": null,
        "text": [
          {
            "highlight_end": 12,
            "highlight_start": 11,
            "text": "fn main() {"
          }
        ]
      },
    ]
  }
```

一个新的问题蹦了出来，RA 不也是一个 `rust` 的编译器前端吗，也可以给出报错信息，为啥还要依赖别人的呢？

一是给出清晰易读的报错信息并不是一件容易的事情，既然已经有现成的工具可以用，就没必要自己再重复造轮子。vscode 中可以配置 `"rust-analyzer.checkOnSave.enable": false` 来关闭 `cargo check` ，关闭之后，发现 rust-analyzer 做的 diagnostic 非常有限，比如 println! 少打一个 `n` , RA 并不会报错，也缺少对 ownership 和 borrow check 的检查。

二是 RA 是自己重新写的 parser，使用 `cargo check` 的好处是 RA 不必保证自己的 grammer 和 rustc 完全一致，只需要保证 rustc 能 parse 的 RA 也能 parse 就行，那些 RA 可以 parse 但实际不被 rustc 接受的，cargo check 可以给出报错信息，对于 Language Server 来说足够了。