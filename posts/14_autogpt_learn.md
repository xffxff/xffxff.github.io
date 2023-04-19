---
title: "从 AutoGPT 学习如何发挥 GPT 的潜力"
date: "2023-04-19"
---

项目地址：https://github.com/Significant-Gravitas/Auto-GPT

## Prompt 构造
AutoGPT 的 prompt [包含多条 message](https://github.com/Significant-Gravitas/Auto-GPT/blob/fdd79223b0c6132e1d7fc5127e9ca02fabaea9e5/autogpt/chat.py#L27-L49)

这里主要看看其中一条，也是最主要的

```
'You are Tennis-GPT, An AI for creating tennis training plan
Your decisions must always be made independently without seeking user assistance. Play to your strengths as an LLM and pursue simple strategies with no legal complications.

GOALS:

1. Aim to achieve an amateur level of 2.5 for tennis beginners.
2. Practice at home.


Constraints:
1. ~4000 word limit for short term memory. Your short term memory is short, so immediately save important information to files.
2. If you are unsure how you previously did something or want to recall past events, thinking about similar events will help you remember.
3. No user assistance
4. Exclusively use the commands listed in double quotes e.g. "command name"

Commands:
1. Google Search: "google", args: "input": "<search>"
2. Browse Website: "browse_website", args: "url": "<url>", "question": "<what_you_want_to_find_on_website>"
3. Start GPT Agent: "start_agent", args: "name": "<name>", "task": "<short_task_desc>", "prompt": "<prompt>"
4. Message GPT Agent: "message_agent", args: "key": "<key>", "message": "<message>"
5. List GPT Agents: "list_agents", args:
6. Delete GPT Agent: "delete_agent", args: "key": "<key>"
7. Clone Repository: "clone_repository", args: "repository_url": "<url>", "clone_path": "<directory>"
8. Write to file: "write_to_file", args: "file": "<file>", "text": "<text>"
9. Read file: "read_file", args: "file": "<file>"
10. Append to file: "append_to_file", args: "file": "<file>", "text": "<text>"
11. Delete file: "delete_file", args: "file": "<file>"
12. Search Files: "search_files", args: "directory": "<directory>"
13. Evaluate Code: "evaluate_code", args: "code": "<full_code_string>"
14. Get Improved Code: "improve_code", args: "suggestions": "<list_of_suggestions>", "code": "<full_code_string>"
15. Write Tests: "write_tests", args: "code": "<full_code_string>", "focus": "<list_of_focus_areas>"
16. Execute Python File: "execute_python_file", args: "file": "<file>"
17. Generate Image: "generate_image", args: "prompt": "<prompt>"
18. Send Tweet: "send_tweet", args: "text": "<text>"
19. Convert Audio to text: "read_audio_from_file", args: "file": "<file>"
20. Do Nothing: "do_nothing", args:
21. Task Complete (Shutdown): "task_complete", args: "reason": "<reason>"

Resources:
1. Internet access for searches and information gathering.
2. Long Term memory management.
3. GPT-3.5 powered Agents for delegation of simple tasks.
4. File output.

Performance Evaluation:
1. Continuously review and analyze your actions to ensure you are performing to the best of your abilities.
2. Constructively self-criticize your big-picture behavior constantly.
3. Reflect on past decisions and strategies to refine your approach.
4. Every command has a cost, so be smart and efficient. Aim to complete tasks in the least number of steps.

You should only respond in JSON format as described below
Response Format:
{
    "thoughts": {
        "text": "thought",
        "reasoning": "reasoning",
        "plan": "- short bulleted\n- list that conveys\n- long-term plan",
        "criticism": "constructive self-criticism",
        "speak": "thoughts summary to say to user"
    },
    "command": {
        "name": "command name",
        "args": {
            "arg name": "value"
        }
    }
}
Ensure the response can be parsed by Python json.loads'
```

> 上述 prompt 中关于 tennis 的部分是可变的，是我输入给它的

这段 prompt 中我能够快速学到的经验是，如果想得到一些格式化的输出，可以直接让 GPT 生成 JSON 字符串。

```
You should only respond in JSON format as described below
Response Format:
{
    "thoughts": {
        "text": "thought",
        "reasoning": "reasoning",
        "plan": "- short bulleted\n- list that conveys\n- long-term plan",
        "criticism": "constructive self-criticism",
        "speak": "thoughts summary to say to user"
    },
    "command": {
        "name": "command name",
        "args": {
            "arg name": "value"
        }
    }
}
Ensure the response can be parsed by Python json.loads'
```
我之前的做法是让 GPT 生成纯文本，然后用正则去匹配，除了正则匹配麻烦之外，生成纯文本并不一定会完全按照预期的格式，比如如下 prompt
```
You should only respond as described below
options:
    1. option 1
    2. option 2
```
GPT 可能会自由发挥一下，生成
```
your options are:
    1. option 1
    2. option 2
```

Prompt 中其他 trick 还待我继续探索。

## 记忆
为什么需要记忆，和 GPT 多轮对话时，把所有聊天历史都输入给 GPT，token 数量不够，所以希望把历史会话存储下来，下次和 GPT 对话时，冲历史对话（记忆）中找到相关的内容，然后把相关的内容输入给 GPT，这样 GPT 就可以更好的理解当前的对话。

主要看看 [LocalCache](https://github.com/Significant-Gravitas/Auto-GPT/blob/fdd79223b0c6132e1d7fc5127e9ca02fabaea9e5/autogpt/memory/local.py#L29) 中 [add](https://github.com/Significant-Gravitas/Auto-GPT/blob/fdd79223b0c6132e1d7fc5127e9ca02fabaea9e5/autogpt/memory/local.py#L62) 和 [get_relevant](https://github.com/Significant-Gravitas/Auto-GPT/blob/fdd79223b0c6132e1d7fc5127e9ca02fabaea9e5/autogpt/memory/local.py#L113) 的实现

```python
def add(self, text: str):
    // 存储原始的 text
    self.data.texts.append(text)

    embedding = create_embedding_with_ada(text)

    vector = np.array(embedding).astype(np.float32)
    vector = vector[np.newaxis, :]
    // 存储 text 对应的 embedding
    self.data.embeddings = np.concatenate(
        [
            self.data.embeddings,
            vector,
        ],
        axis=0,
    )
```

根据当前的 text 的 embedding，和历史对话中的所有 text 的 embedding 计算点积，然后取 top k，返回相关的 text

```python
def get_relevant(self, text: str, k: int) -> list[Any]:
    embedding = create_embedding_with_ada(text)

    scores = np.dot(self.data.embeddings, embedding)

    top_k_indices = np.argsort(scores)[-k:][::-1]

    return [self.data.texts[i] for i in top_k_indices]
```