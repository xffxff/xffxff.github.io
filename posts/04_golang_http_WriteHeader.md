---
title: "golang http WriteHeader 的一个注意事项"
date: "2022-08-08"
---


<!-- more -->

```go
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
)

func main() {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"key": "value"})
	}))
	defer ts.Close()

	res, err := http.Get(ts.URL)
	fmt.Printf("res.Status: %v\n", res.Status)
	fmt.Printf("res.Header: %v\n", res.Header["Content-Type"])
	if err != nil {
		log.Fatal(err)
	}
	var data map[string]string
	err = json.NewDecoder(res.Body).Decode(&data)
	res.Body.Close()
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("data: %v\n", data)
}
```
[PlayGround](https://go.dev/play/p/vNKFQKHVOKd)

运行结果  
```bash
res.Status: 200 OK
res.Header: [text/plain; charset=utf-8]
data: map[key:value]
```


希望返回的 `Content-Type` 为 json，很简单，只需要在返回的 response 中设置 `Content-Type` 就好了  
```diff
 func main() {
        ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+               w.WriteHeader(http.StatusOK)
+               w.Header().Set("Content-Type", "application/json")
                json.NewEncoder(w).Encode(map[string]string{"key": "value"})
        }))
        defer ts.Close()
```
[PlayGround](https://go.dev/play/p/56gWJmIiBP3)


奇怪的事情发生了，结果没有改变，`Content-Type` 仍然为 `text/plain`。  

反复尝试后发现，不加 `WriteHeader` 返回的 `Content-Type` 就为 `application/json` 了    
```diff
func main() {
        ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+               w.Header().Set("Content-Type", "application/json")
                json.NewEncoder(w).Encode(map[string]string{"key": "value"})
        }))
        defer ts.Close()
```
[PlayGround](https://go.dev/play/p/AFKdAdp1Gty)  

在 go 的一个 [issue](https://github.com/golang/go/issues/17083#issuecomment-246544520) 中找到了答案，对 `Header` 的更改只能发生在 `WriteHeader` 之前。 

[文档](https://pkg.go.dev/net/http#ResponseWriter)中其实已经写得很清楚了  
> Header returns the header map that will be sent by WriteHeader. Changing the header map after a call to WriteHeader (or Write) has no effect

也就是说下面这种写法是 OK 的
```diff
 func main() {
        ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+               w.Header().Set("Content-Type", "application/json")
+               w.WriteHeader(http.StatusOK)
                json.NewEncoder(w).Encode(map[string]string{"key": "value"})
        }))
        defer ts.Close()
```
