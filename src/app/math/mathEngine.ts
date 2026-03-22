export type Operation = "add" | "sub" | "mul" | "div" | "mod";

export type MathConfig = {
  operations: Operation[];
  totalQuestions: number;
};

export type Question = {
  a: number;
  b: number;
  op: Operation;
  answer: number;
  display: string;
};

const OP_SYMBOL: Record<Operation, string> = {
  add: "+",
  sub: "−",
  mul: "×",
  div: "÷",
  mod: "%",
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateQuestion(ops: Operation[]): Question {
  const op = ops[randInt(0, ops.length - 1)];

  let a: number, b: number, answer: number;

  switch (op) {
    case "add": {
      a = randInt(1, 99);
      b = randInt(1, 100 - a);
      answer = a + b;
      break;
    }
    case "sub": {
      a = randInt(1, 99);
      b = randInt(1, a);
      answer = a - b;
      break;
    }
    case "mul": {
      a = randInt(2, 12);
      b = randInt(2, Math.min(12, Math.floor(100 / a)));
      answer = a * b;
      break;
    }
    case "div": {
      b = randInt(2, 12);
      answer = randInt(1, Math.min(12, Math.floor(100 / b)));
      a = b * answer;
      break;
    }
    case "mod": {
      a = randInt(10, 99);
      b = randInt(2, 9);
      answer = a % b;
      break;
    }
  }

  return {
    a,
    b,
    op,
    answer,
    display: `${a} ${OP_SYMBOL[op]} ${b}`,
  };
}

export function generateQuestionSet(ops: Operation[], count: number): Question[] {
  const seen = new Set<string>();
  const questions: Question[] = [];

  let attempts = 0;
  while (questions.length < count && attempts < count * 10) {
    const q = generateQuestion(ops);
    const key = `${q.a}${q.op}${q.b}`;
    if (!seen.has(key)) {
      seen.add(key);
      questions.push(q);
    }
    attempts++;
  }

  // Fill remaining if we couldn't find enough unique ones
  while (questions.length < count) {
    questions.push(generateQuestion(ops));
  }

  return questions;
}
