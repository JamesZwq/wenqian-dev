"use client";

import { useEffect, useMemo, useState } from "react";

type Todo = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
};

const STORAGE_KEY = "gm_todos_v1";

function uid() {
  return (
    Math.random().toString(16).slice(2) +
    "-" +
    Date.now().toString(16)
  );
}

const DEFAULT_TODOS: string[] = [
  "(Thu) 从 roster 复制本周 3 位 presenter 信息，并发到评委群认领",
  "(Thu) 检查 roster 是否缺人；缺人就催对应学校负责人补齐",
  "(Thu) 检查评分表/评委认领是否有缺失；缺失就提醒",
  "(Fri 10/11) 若还没人认领，发消息催认领",
  "(Meeting) 每个 talk 前确认点评老师在线；不在就微信提醒",
  "(After) 会后把评分表转发到评委群",
];

export function TodoList() {
  const [items, setItems] = useState<Todo[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Todo[];
      if (Array.isArray(parsed)) setItems(parsed);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

  const remaining = useMemo(
    () => items.filter((x) => !x.done).length,
    [items],
  );

  function addTodo(t: string) {
    const v = t.trim();
    if (!v) return;
    setItems((xs) => [
      { id: uid(), text: v, done: false, createdAt: Date.now() },
      ...xs,
    ]);
    setText("");
  }

  function toggle(id: string) {
    setItems((xs) =>
      xs.map((x) =>
        x.id === id ? { ...x, done: !x.done } : x,
      ),
    );
  }

  function remove(id: string) {
    setItems((xs) => xs.filter((x) => x.id !== id));
  }

  function seed() {
    setItems((xs) => {
      const existing = new Set(xs.map((x) => x.text));
      const add = DEFAULT_TODOS.filter(
        (t) => !existing.has(t),
      ).map((t) => ({
        id: uid(),
        text: t,
        done: false,
        createdAt: Date.now(),
      }));
      return [...add, ...xs];
    });
  }

  function clearDone() {
    setItems((xs) => xs.filter((x) => !x.done));
  }

  return (
    <div className="card">
      <h2>TODO</h2>
      <div className="small" style={{ marginBottom: 10 }}>
        本地保存（localStorage），不会写回 Google Sheet。未完成：
        {remaining} / {items.length}
      </div>

      <div
        className="btnRow"
        style={{ marginBottom: 10 }}
      >
        <button className="btn" onClick={seed}>
          导入默认 SOP
        </button>
        <button
          className="btn danger"
          onClick={clearDone}
        >
          清理已完成
        </button>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          placeholder="Add a TODO…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTodo(text);
          }}
        />
        <button
          className="btn primary"
          onClick={() => addTodo(text)}
        >
          Add
        </button>
      </div>

      <div style={{ height: 10 }} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {items.length === 0 && (
          <div className="small">
            暂无 TODO。可以点“导入默认 SOP”。
          </div>
        )}
        {items.map((x) => (
          <div
            key={x.id}
            style={{
              border: "1px solid rgba(28,36,64,0.65)",
              borderRadius: 12,
              padding: "10px 10px",
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <label
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                flex: 1,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={x.done}
                onChange={() => toggle(x.id)}
                style={{ marginTop: 2 }}
              />
              <div
                style={{
                  fontSize: 13,
                  color: x.done
                    ? "var(--muted)"
                    : "var(--text)",
                  textDecoration: x.done
                    ? "line-through"
                    : "none",
                  lineHeight: 1.35,
                }}
              >
                {x.text}
              </div>
            </label>
            <button
              className="btn"
              onClick={() => remove(x.id)}
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

