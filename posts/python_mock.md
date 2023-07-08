---
title: '深入理解 Python Mock 库：Mock，patch 和 patch.object 的实现原理'
date: '2023-07-08'
---

Python 中 `unittest.mock` 是我经常用到的一个库，它提供了非常方便的 mock 功能，可以帮助我们写出更好的单元测试。本文不是介绍 `unittest.mock` 的使用，而是探讨它的实现原理，从零开始实现 `unittest.mock` 中的 `Mock`，`patch` 和 `patch.object`，帮助我们更好地理解它们的工作原理。


## 如何 mock 一个函数

假如有一个函数 `random_boolean`，实现如下：

```python
import random
def random_boolean(threshold=0.5):
    return random.random() < threshold
```

我现在想给这个函数写一个单元测试，测试它的返回值是否符合预期，应该怎么做呢？

这时候可以 mock `random.random()`，让它总是返回小于 0.5 的值，测试 `random_boolean` 的返回值是否为 `True`。

```python
from unittest.mock import patch
from my_module import random_boolean

def test_random_boolean():
    with patch('random.random', new=lambda: random.uniform(0, 0.5)):
        assert random_boolean() == True
```

接下来如何实现 `patch`，让它完成上述的功能呢？

### 实现 patch

```python
import importlib

class Patch:
    def __init__(self, target, new):
        self.target = target
        self.new = new
        self.original = None

    def __enter__(self):
        # Split the target into module and attribute
        parts = self.target.split('.')
        module_name = '.'.join(parts[:-1])
        attr_name = parts[-1]
        
        # Import the module and get the original attribute
        module = importlib.import_module(module_name)
        self.original = getattr(module, attr_name)
        
        # Replace the original attribute with the new one
        setattr(module, attr_name, self.new)
        return self.new

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Restore the original attribute when exiting the with block
        parts = self.target.split('.')
        module_name = '.'.join(parts[:-1])
        attr_name = parts[-1]
        module = importlib.import_module(module_name)
        setattr(module, attr_name, self.original)

def patch(target, new):
    return Patch(target, new)
```

实现的核心思路是，通过 `importlib.import_module` 导入需要 patch 的模块（`random`），然后通过 `setattr` 将模块中的需要 patch 的属性（random 模块中的 `random()` 函数）替换为新的值（`lambda: random.uniform(0, 0.5)`）。替换只在 `with` 语句块中生效，`with` 语句块结束后，再将原来的值赋回去。

## 如何 mock 一个类方法

假设现在有这样一个类：

```python
class ProductionClass:
    def method(self):
        return self.something(1, 2, 3)
    def something(self, a, b, c):
        pass
```

我想 mock `something` 方法，可以用 `unittest.mock.patch.object` 来实现：

```python
from unittest.mock import patch
from my_module import ProductionClass

def test_method():
    with patch.object(ProductionClass, 'something', new=lambda self, a, b, c: 3) as mock_method:
        assert ProductionClass().method() == 3
```

### 实现 patch.object

```python
class PatchObject:
    def __init__(self, target, attr, new):
        self.target = target
        self.attr = attr
        self.new = new
        self.original = None

    def __enter__(self):
        # Get the original attribute
        self.original = getattr(self.target, self.attr)
        
        # Replace the original attribute with the new one
        setattr(self.target, self.attr, self.new)
        return self.new

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Restore the original attribute when exiting the with block
        setattr(self.target, self.attr, self.original)

def patch_object(target, attr, new):
    return PatchObject(target, attr, new)
```

实现的核心思路是，通过 `getattr` 获取需要 patch 的属性（`something` 方法），然后通过 `setattr` 将属性替换为新的值（`lambda self, a, b, c: 3`）。替换只在 `with` 语句块中生效，`with` 语句块结束后，再将原来的值赋回去。

## 实现 Mock

```python
class Mock:
    def __init__(self, return_value=None):
        self._methods = {}
        self.return_value = return_value
        self.call_count = 0
        self.call_args = None

    def __getattr__(self, name):
        if name not in self._methods:
            self._methods[name] = Mock()
        return self._methods[name]

    def __setattr__(self, name, value):
        if isinstance(value, Mock):
            self._methods[name] = value
        else:
            super().__setattr__(name, value)
    
    def __call__(self, *args, **kwargs):
        self.call_count += 1
        self.call_args = (args, kwargs)
        if self.return_value is None:
            return Mock()
        return self.return_value
```

Mock 类的主要工作原理是，当我们试图访问它的一个属性时，如果这个属性不存在，那么它就会创建一个新的 Mock 实例并返回。这样，我们就可以无限制地访问它的属性，每个属性都是一个新的 Mock 实例。当我们调用 Mock 实例时，它会记录调用的次数和参数，并返回一个预设的值或者一个新的 Mock 实例。

---

通过上述的讨论，我们深入地了解了 Python 的 mock 库的实现原理。我们了解了如何通过修改模块的属性来模拟函数或者方法的行为，以及如何通过 Mock 类来模拟对象的行为。然而，实际的 mock 库的实现要比我们讨论的更复杂，它还包括了很多其他的特性，例如 side_effect、call_args_list 等。如果你对这个主题感兴趣，我鼓励你去阅读 Python 官方文档或者 mock 库的源代码，以获取更深入的理解。