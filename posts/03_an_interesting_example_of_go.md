---
title: "一个关于 go 语言的有趣例子"
date: "2022-03-31"
---

最近公司项目要用到 go，在看同事代码的时候发现一个有趣的写法，接下来我尝试用简单的例子去复现。

<!-- more -->

```go
package main

import "fmt"

type Hello interface {
	hello()
}

type Foo struct{}

func (f Foo) hello() {}

func hello(h interface{}) {
	switch h.(type) {
	case Hello:
		fmt.Println("Hello")
	case *Hello:
		fmt.Println("*Hello")
	}
}
```
我的问题就是我应该给 `func hello(h interface{})` 传一个什么样的参数，使得能够被 `case *Hello` 捕获。  

```
foo := Foo{}
hello(&foo)
```
不行

```
foo := Foo{}
hello(&&foo)
```
编译不通过  

在同事的指点下，发现下面这样写是可以的  
```
foo := Foo{}
var h Hello = &foo
hello(&h)
```
想想也合理，`case *Hello` 要捕获类型为 `*Hello`。上面代码中只有 `&h` 符合要求。

