---
title: "anyhow vs error_stack: 从用户的角度来看错误处理"
date: "2023-06-19"
---

本文围绕一个例子，以用户的角度来讨论 [anyhow](https://docs.rs/anyhow/latest/anyhow/), [error_stack](https://docs.rs/error-stack/latest/error_stack/) 解决了什么样的需求，能否给错误处理带来便利。

> 本文的例子改编自 [error_stack README.md](https://github.com/hashintel/hash/blob/main/libs/error-stack/README.md)

## `Box<dyn std::error::Error>`
在讨论 anyhow 和 error_stack 之前，我们先来看看我们的 baseline：用 `Box<dyn std::error::Error>` 来处理错误。

这是最粗暴的错误处理方式，所有的错误都被转换成了 `Box<dyn std::error::Error>`。

看到下面这么大一段代码，你肯定很头疼，不过不用担心，我们并不需要阅读这段代码，你可以把自己想象成这段代码的维护者，你刚接手这段代码，现在遇到一个报错，你需要定位到错误的原因。你需要从报错信息入手，思考如何定位到错误的原因。

```rust
type BoxDynError = Box<dyn std::error::Error>;

fn parse_experiment(description: &str) -> Result<(u64, u64), BoxDynError> {
    let value = description.parse()?;

    Ok((value, 2 * value))
}

fn start_experiments(
    experiment_ids: &[usize],
    experiment_descriptions: &[&str],
) -> Result<Vec<u64>, BoxDynError> {
    let experiments = experiment_ids
        .iter()
        .map(|exp_id| {
            let description = match experiment_descriptions.get(*exp_id) {
                Some(desc) => desc,
                None => return Err(format!("experiment {exp_id} has no valid description").into()),
            };
            let experiment = parse_experiment(description)?;

            Ok(move || experiment.0 * experiment.1)
        })
        .collect::<Result<Vec<_>, BoxDynError>>()?;

    Ok(experiments.iter().map(|experiment| experiment()).collect())
}

fn main() -> Result<(), BoxDynError> {
    let experiment_ids = &[0, 2];
    let experiment_descriptions = &["10", "20", "3o"];
    start_experiments(experiment_ids, experiment_descriptions)?;

    Ok(())
}

```

运行这段代码，会得到如下的错误信息：
```text
Error: ParseIntError { kind: InvalidDigit }
```

作为开发者，看到这段错误信息，我很难快速定位到错误的原因。我需要阅读代码，才能知道错误发生在哪里。如果要定位到错误的原因，我希望得到什么样的信息呢？
最好有 backtrace, 帮助定位到错误发生的位置，还希望能够得到错误的上下文信息，比如和报错相关的变量的值。接下来我们来看看 anyhow 和 error_stack 能否帮助我们更快速的定位到错误的原因。

## anyhow

anyhow 的使用方式和 `Box<dyn std::error::Error>` 非常类似，我们只需要将 `Box<dyn std::error::Error>` 替换成 `anyhow::Error` 即可。

```diff
+ use anyhow::Context;

- fn parse_experiment(description: &str) -> Result<(u64, u64), BoxDynError> {
+ fn parse_experiment(description: &str) -> Result<(u64, u64), anyhow::Error> {
    let value = description
        .parse()
+        .context(format!("{description:?} could not be parsed as experiment"))?;

    Ok((value, 2 * value))
}

fn start_experiments(
    experiment_ids: &[usize],
    experiment_descriptions: &[&str],
) -> Result<Vec<u64>, anyhow::Error> {
    let experiments = experiment_ids
        .iter()
        .map(|exp_id| {
            let description = experiment_descriptions
                .get(*exp_id)
+                .context(format!("experiment {exp_id} has no valid description"))?;
            let experiment = parse_experiment(description)
+                .context(format!("experiment {exp_id} could not be parsed"))?;

            Ok(move || experiment.0 * experiment.1)
        })
        .collect::<Result<Vec<_>, anyhow::Error>>()
+        .context(format!("unable to set up experiments"))?;

    Ok(experiments.iter().map(|experiment| experiment()).collect())
}

fn main() -> Result<(), anyhow::Error> {
    let experiment_ids = &[0, 2];
    let experiment_descriptions = &["10", "20", "3o"];
    start_experiments(experiment_ids, experiment_descriptions)?;

    Ok(())
}
```
> **注意**：上述 diff 中并没有展示所有的改动，比如有些 `Box<dyn std::error::Error>` 的改动，以及 `?` 的改动。

除了将 `Box<dyn std::error::Error>` 替换成 `anyhow::Error` 之外，我们还使用了 `anyhow::Context` 来为错误添加上下文信息。

运行这段代码，会得到如下的错误信息：
```text
Error: unable to set up experiments

Caused by:
    0: experiment 2 could not be parsed
    1: "3o" could not be parsed as experiment
    2: invalid digit found in string
```
这里的错误信息多是通过 `context` 添加的上下文信息，可以看到，我们已经能够快速定位到错误的原因了： `3o` 不能被解析成数字。

但我们现在不能快速定位到错误发生的具体位置，这需要 backtrace 信息。anyhow 能提供 backtrace 吗？当然可以，我们只需要在运行程序的时候，设置环境变量 `RUST_BACKTRACE=1` 即可。

```text
Error: unable to set up experiments

Caused by:
    0: experiment 2 could not be parsed
    1: "3o" could not be parsed as experiment
    2: invalid digit found in string

Stack backtrace:
   0: anyhow::context::<impl anyhow::Context<T,E> for core::result::Result<T,E>>::context
             at /root/.cargo/registry/src/rsproxy.cn-8f6827c7555bfaf8/anyhow-1.0.71/src/context.rs:54:31
   1: anyhow::parse_experiment
             at ./src/bin/anyhow.rs:4:17
   2: anyhow::start_experiments::{{closure}}
             at ./src/bin/anyhow.rs:21:30
   3: core::iter::adapters::map::map_try_fold::{{closure}}
             at /rustc/90c541806f23a127002de5b4038be731ba1458ca/library/core/src/iter/adapters/map.rs:91:28
   4: core::iter::traits::iterator::Iterator::try_fold
             at /rustc/90c541806f23a127002de5b4038be731ba1458ca/library/core/src/iter/traits/iterator.rs:2304:21
   5: <core::iter::adapters::map::Map<I,F> as core::iter::traits::iterator::Iterator>::try_fold
             at /rustc/90c541806f23a127002de5b4038be731ba1458ca/library/core/src/iter/adapters/map.rs:117:9
   6: <core::iter::adapters::GenericShunt<I,R> as core::iter::traits::iterator::Iterator>::try_fold
             at /rustc/90c541806f23a127002de5b4038be731ba1458ca/library/core/src/iter/adapters/mod.rs:195:9
...
```
> **注意**：如果用的是 stable 版本的 rust，需要对 anyhow 添加 "backtrace" feature，才能使用 backtrace 功能。   

虽然 anyhow 能够提供 backtrace 信息，但是这个 backtrace 信息并不是很友好，包含了太多冗余信息（比如 rust core lib 的 backtrace）。这一点，我们可以通过 error_stack 来改进。

## error_stack

```diff
+ use std::fmt;

+ use error_stack::{Context, IntoReport, Report, Result, ResultExt};

+ #[derive(Debug)]
+ struct ParseExperimentError;

+ impl fmt::Display for ParseExperimentError {
+     fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
+         fmt.write_str("invalid experiment description")
+     }
+ }

+ impl Context for ParseExperimentError {}

- fn parse_experiment(description: &str) -> Result<(u64, u64), BoxDynError> {
+ fn parse_experiment(description: &str) -> Result<(u64, u64), ParseExperimentError> {
    let value = description
        .parse()
+         .into_report()
+         .attach_printable_lazy(|| format!("{description:?} could not be parsed as experiment"))
+         .change_context(ParseExperimentError)?;

    Ok((value, 2 * value))
}

+ #[derive(Debug)]
+ struct ExperimentError;

+ impl fmt::Display for ExperimentError {
+     fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
+         fmt.write_str("experiment error: could not run experiment")
+     }
+ }

+ impl Context for ExperimentError {}

fn start_experiments(
    experiment_ids: &[usize],
    experiment_descriptions: &[&str],
) -> Result<Vec<u64>, ExperimentError> {
    let experiments = experiment_ids
        .iter()
        .map(|exp_id| {
            let description = experiment_descriptions.get(*exp_id).ok_or_else(|| {
+                 Report::new(ExperimentError)
+                     .attach_printable(format!("experiment {exp_id} has no valid description"))
            })?;

            let experiment = parse_experiment(description)
+                 .attach_printable(format!("experiment {exp_id} could not be parsed"))
+                 .change_context(ExperimentError)?;

            Ok(move || experiment.0 * experiment.1)
        })
        .collect::<Result<Vec<_>, ExperimentError>>()
+       .attach_printable("unable to set up experiments")?;

    Ok(experiments.iter().map(|experiment| experiment()).collect())
}

fn main() -> Result<(), ExperimentError> {
    let experiment_ids = &[0, 2];
    let experiment_descriptions = &["10", "20", "3o"];
    start_experiments(experiment_ids, experiment_descriptions)?;

    Ok(())
}
```
> **注意**：以上并不是严格的 diff，只是展示了主要的改动。

运行这段代码，会得到如下的错误信息：
```text
Error: experiment error: could not run experiment
├╴at src/bin/error_stack.rs:51:18
├╴unable to set up experiments
│
├─▶ invalid experiment description
│   ├╴at src/bin/error_stack.rs:21:10
│   ╰╴experiment 2 could not be parsed
│
╰─▶ invalid digit found in string
    ├╴at src/bin/error_stack.rs:19:10
    ╰╴"3o" could not be parsed as experiment
```

和 anyhow 相比，error_stack 需要我们编写更多的代码，但是 error_stack 提供的错误信息更加友好，给我们展示了每一个层级的错误信息，上下文信息以及错误发生的具体位置。


总结一下，anyhow 和 error_stack 都是非常优秀的 error handling crate，它们都提供了友好的错误信息，可以帮助我们快速定位错误。anyhow 的优势在于它的使用非常简单，几乎不需要我们编写额外的代码。error_stack 的优势在于它的错误信息更加友好，更友好地展示错误发生的位置以及错误的上下文信息，但是它的使用比较复杂，需要我们编写额外的代码。





