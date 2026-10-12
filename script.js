// 問題データは questions.js の questions 定数から読み込む

const questionScreen = document.getElementById("question-screen");
const resultScreen = document.getElementById("result-screen");
const progressEl = document.getElementById("progress");
const questionTextEl = document.getElementById("question-text");
const choicesEl = document.getElementById("choices");
const feedbackEl = document.getElementById("feedback");
const nextButton = document.getElementById("next-button");
const scoreEl = document.getElementById("score");
const scoreMessageEl = document.getElementById("score-message");
const restartButton = document.getElementById("restart-button");

const speakButton = document.getElementById("speak-button");

// 出題順（questions のインデックス）と、その中の現在位置
let queue = [];
let position = 0;
// 間違えた問題のインデックス。最後にまとめて再出題する
let retryQueue = [];
// 復習（間違えた問題の再挑戦）中かどうか
let isRetry = false;
// 1周目で正解した数（復習での正解はスコアに含めない）
let score = 0;
// 表示中の選択肢（シャッフル後）
let currentChoices = [];

// 復習で正解したときに表示する励ましの言葉
const encouragements = [
  "今度はバッチリ！しっかり身についています。",
  "よく覚えていました！その調子です。",
  "リベンジ成功！間違えた問題こそ力になります。",
  "ナイス！苦手をひとつ克服しました。"
];

// 配列をシャッフルした新しい配列を返す（Fisher–Yates）
function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 現在の問題データを返す
function currentQuestion() {
  return questions[queue[position]];
}

// 指定したテキストを日本語で読み上げる（読み上げ中のものは中断する）
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  window.speechSynthesis.speak(utterance);
}

let audioContext = null;

// 指定した周波数・長さの音を鳴らす（start は現在時刻からの開始秒）
function playTone(freq, start, duration, type = "sine", volume = 0.2) {
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const t = audioContext.currentTime + start;
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(t);
  osc.stop(t + duration);
}

// 音を鳴らせる状態にする（鳴らせない環境では false を返す）
function ensureAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return false;
  if (!audioContext) audioContext = new AudioCtx();
  if (audioContext.state === "suspended") audioContext.resume();
  return true;
}

// ボタンを押したときの軽いクリック音
function playClickSound() {
  if (!ensureAudio()) return;
  playTone(880, 0, 0.08, "sine", 0.12);
}

// 復習（間違えた問題への再挑戦）が始まるときの上昇音
function playRetryStartSound() {
  if (!ensureAudio()) return;
  [392.0, 523.25, 659.25].forEach((freq, i) => {
    playTone(freq, i * 0.12, 0.25, "square", 0.08);
  });
}

// 復習で正解したときに、通常の正解音に重ねる「レベルアップ」音
function playLevelUpSound() {
  if (!ensureAudio()) return;
  [1318.51, 1567.98, 2093.0, 2637.02].forEach((freq, i) => {
    playTone(freq, 0.9 + i * 0.07, 0.25, "sine", 0.07);
  });
}

// 結果発表の音（正答率が高いほど華やかなメロディにする）
function playFinishSound(rate) {
  if (!ensureAudio()) return;
  // ドラムロール風に低音を細かく連打する
  for (let i = 0; i < 10; i++) {
    playTone(150, i * 0.05, 0.05, "triangle", 0.15);
  }
  if (rate >= 0.8) {
    // ソ・ソ・ソ・ド〜の勝利ファンファーレ
    [[783.99, 0.6, 0.15], [783.99, 0.78, 0.15], [783.99, 0.96, 0.15], [1046.5, 1.14, 0.9]].forEach(([freq, start, dur]) => {
      playTone(freq, start, dur, "square", 0.1);
    });
    [523.25, 659.25, 783.99].forEach((freq) => playTone(freq, 1.14, 1.0, "triangle", 0.12));
  } else {
    // やさしい上昇メロディ
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      playTone(freq, 0.6 + i * 0.18, 0.4, "triangle", 0.16);
    });
  }
}

// 正解音（ファンファーレ）または不正解音（ブー）を鳴らす
function playResultSound(isCorrect) {
  if (!ensureAudio()) return;

  if (isCorrect) {
    // ドミソド↑の分散和音を鳴らしてから、最後に和音を重ねてファンファーレにする
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      playTone(freq, i * 0.08, 0.3, "triangle", 0.22);
    });
    [1046.5, 1318.51, 1567.98].forEach((freq) => {
      playTone(freq, 0.32, 0.9, "triangle", 0.16);
    });
    // 高音を添えてきらめきを出す
    playTone(2093.0, 0.42, 0.5, "sine", 0.08);
  } else {
    playTone(110, 0, 0.6, "sawtooth", 0.25);
  }
}

// 現在の問題文と選択肢を読み上げる
function speakQuestion() {
  const q = currentQuestion();
  const choicesText = currentChoices.map((c, i) => `${i + 1}番、${c.text}`).join("。");
  speak(`${q.text} ${choicesText}`);
}

// 現在の問題を表示する
function showQuestion() {
  const q = currentQuestion();
  progressEl.textContent = isRetry
    ? `間違えた問題にもう一度挑戦！（${position + 1} / ${queue.length}）`
    : `第${position + 1}問 / 全${questions.length}問`;
  questionTextEl.textContent = q.text;
  feedbackEl.textContent = "";
  feedbackEl.className = "quiz__feedback";
  nextButton.hidden = true;
  choicesEl.innerHTML = "";

  // 正解の位置が偏らないよう、表示のたびに選択肢をシャッフルする
  currentChoices = shuffle(q.choices.map((text, i) => ({ text, isAnswer: i === q.answer })));

  currentChoices.forEach((choice, i) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.textContent = choice.text;
    button.addEventListener("click", () => selectAnswer(i));
    li.appendChild(button);
    choicesEl.appendChild(li);
  });
}

// 選択肢が押されたときの判定とフィードバック表示
function selectAnswer(selected) {
  const q = currentQuestion();
  const buttons = choicesEl.querySelectorAll(".choice");
  const isCorrect = currentChoices[selected].isAnswer;

  buttons.forEach((button, i) => {
    button.disabled = true;
    if (currentChoices[i].isAnswer) button.classList.add("choice--correct");
  });

  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  playResultSound(isCorrect);

  if (isCorrect) {
    if (isRetry) {
      playLevelUpSound();
      const message = encouragements[Math.floor(Math.random() * encouragements.length)];
      feedbackEl.textContent = `正解！ ${message} ${q.explanation}`;
    } else {
      score++;
      feedbackEl.textContent = `正解！ ${q.explanation}`;
    }
    feedbackEl.classList.add("quiz__feedback--correct");
  } else {
    // 間違えた問題は最後にもう一度出題する（正解できるまで繰り返す）
    retryQueue.push(queue[position]);
    buttons[selected].classList.add("choice--wrong");
    feedbackEl.textContent = `不正解… 正解は「${q.choices[q.answer]}」です。${q.explanation}`;
    feedbackEl.classList.add("quiz__feedback--wrong");
  }

  const isLast = position === queue.length - 1;
  if (!isLast) {
    nextButton.textContent = "次へ";
  } else if (retryQueue.length > 0) {
    nextButton.textContent = "間違えた問題に再挑戦";
  } else {
    nextButton.textContent = "結果を見る";
  }
  nextButton.hidden = false;
  nextButton.focus();
}

// 合計スコアを表示する
function showResult() {
  questionScreen.hidden = true;
  resultScreen.hidden = false;
  scoreEl.textContent = `${questions.length}問中${score}問正解`;

  // 正答率に応じてメッセージを変える（問題数が変わっても使えるようにする）
  const rate = score / questions.length;
  playFinishSound(rate);
  if (rate === 1) {
    scoreMessageEl.textContent = "全問正解！栄養サポートも任せられるレベルです！";
  } else if (rate >= 0.8) {
    scoreMessageEl.textContent = "素晴らしい！実践でもしっかり活かせています。";
  } else if (rate >= 0.6) {
    scoreMessageEl.textContent = "いい調子！あと一歩で栄養マスターです。";
  } else if (rate >= 0.4) {
    scoreMessageEl.textContent = "基本は押さえています。解説を読み返してみましょう。";
  } else {
    scoreMessageEl.textContent = "ここからが伸びしろ。もう一度挑戦してみましょう！";
  }

  // 復習をした場合は、すべてクリアしたことを伝える
  if (score < questions.length) {
    scoreMessageEl.textContent += " 間違えた問題もすべてクリアできました！";
  }
}

// クイズを最初から始める
function start() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  queue = questions.map((_, i) => i);
  position = 0;
  retryQueue = [];
  isRetry = false;
  score = 0;
  resultScreen.hidden = true;
  questionScreen.hidden = false;
  showQuestion();
}

if (!("speechSynthesis" in window)) {
  speakButton.hidden = true;
}
speakButton.addEventListener("click", () => {
  playClickSound();
  speakQuestion();
});

nextButton.addEventListener("click", () => {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  position++;
  if (position < queue.length) {
    playClickSound();
    showQuestion();
  } else if (retryQueue.length > 0) {
    // 間違えた問題だけを集めて、もう一度出題する
    queue = retryQueue;
    retryQueue = [];
    position = 0;
    isRetry = true;
    playRetryStartSound();
    showQuestion();
  } else {
    showResult();
  }
});

restartButton.addEventListener("click", () => {
  playClickSound();
  start();
});

start();
