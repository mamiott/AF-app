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

let currentIndex = 0;
let score = 0;

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

// 正解音（ピンポン）または不正解音（ブー）を鳴らす
function playResultSound(isCorrect) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!audioContext) audioContext = new AudioCtx();
  if (audioContext.state === "suspended") audioContext.resume();

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
  const q = questions[currentIndex];
  const choicesText = q.choices.map((c, i) => `${i + 1}番、${c}`).join("。");
  speak(`${q.text} ${choicesText}`);
}

// 現在の問題を表示する
function showQuestion() {
  const q = questions[currentIndex];
  progressEl.textContent = `第${currentIndex + 1}問 / 全${questions.length}問`;
  questionTextEl.textContent = q.text;
  feedbackEl.textContent = "";
  feedbackEl.className = "quiz__feedback";
  nextButton.hidden = true;
  choicesEl.innerHTML = "";

  q.choices.forEach((choice, i) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.textContent = choice;
    button.addEventListener("click", () => selectAnswer(i));
    li.appendChild(button);
    choicesEl.appendChild(li);
  });
}

// 選択肢が押されたときの判定とフィードバック表示
function selectAnswer(selected) {
  const q = questions[currentIndex];
  const buttons = choicesEl.querySelectorAll(".choice");
  const isCorrect = selected === q.answer;

  buttons.forEach((button, i) => {
    button.disabled = true;
    if (i === q.answer) button.classList.add("choice--correct");
  });

  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  playResultSound(isCorrect);

  if (isCorrect) {
    score++;
    feedbackEl.textContent = `正解！ ${q.explanation}`;
    feedbackEl.classList.add("quiz__feedback--correct");
  } else {
    buttons[selected].classList.add("choice--wrong");
    feedbackEl.textContent = `不正解… 正解は「${q.choices[q.answer]}」です。${q.explanation}`;
    feedbackEl.classList.add("quiz__feedback--wrong");
  }

  nextButton.textContent = currentIndex === questions.length - 1 ? "結果を見る" : "次へ";
  nextButton.hidden = false;
}

// 合計スコアを表示する
function showResult() {
  questionScreen.hidden = true;
  resultScreen.hidden = false;
  scoreEl.textContent = `${questions.length}問中${score}問正解`;

  // 正答率に応じてメッセージを変える（問題数が変わっても使えるようにする）
  const rate = score / questions.length;
  if (rate === 1) {
    scoreMessageEl.textContent = "全問正解！栄養サポートも任せられるレベルです！";
  } else if (rate >= 0.8) {
    scoreMessageEl.textContent = "素晴らしい！実践でもしっかり活かせています。";
  } else if (rate >= 0.6) {
    scoreMessageEl.textContent = "good！あと一歩で栄養マスターです。";
  } else if (rate >= 0.4) {
    scoreMessageEl.textContent = "基本は押さえています。解説を読み返してみましょう。";
  } else {
    scoreMessageEl.textContent = "ここからが伸びしろ。もう一度挑戦してみましょう！";
  }
}

function restart() {
  currentIndex = 0;
  score = 0;
  resultScreen.hidden = true;
  questionScreen.hidden = false;
  showQuestion();
}

if (!("speechSynthesis" in window)) {
  speakButton.hidden = true;
}
speakButton.addEventListener("click", speakQuestion);

nextButton.addEventListener("click", () => {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  currentIndex++;
  if (currentIndex < questions.length) {
    showQuestion();
  } else {
    showResult();
  }
});

restartButton.addEventListener("click", restart);

showQuestion();
