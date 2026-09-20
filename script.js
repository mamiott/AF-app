// クイズの問題データ（answer は choices の正解位置。0 始まり）
const questions = [
  {
    text: "日本で一番面積が大きい都道府県はどこ？",
    choices: ["北海道", "岩手県", "長野県", "福島県"],
    answer: 0,
    explanation: "北海道は日本の総面積の約2割を占めています。"
  },
  {
    text: "1年のうち、日本で昼の長さが最も長くなる日は？",
    choices: ["春分の日", "夏至", "秋分の日", "冬至"],
    answer: 1,
    explanation: "夏至は太陽が最も高く昇り、昼が一番長くなります。"
  },
  {
    text: "水が氷になる温度は、1気圧のもとで何℃？",
    choices: ["-10℃", "0℃", "4℃", "10℃"],
    answer: 1,
    explanation: "水は1気圧では0℃で凍り始めます。"
  },
  {
    text: "一般に、1週間は何日？",
    choices: ["5日", "6日", "7日", "8日"],
    answer: 2,
    explanation: "月曜から日曜までの7日間が1週間です。"
  },
  {
    text: "日本の国会が二つの議院で構成されているのはどれ？",
    choices: ["衆議院と参議院", "貴族院と衆議院", "元老院と参議院", "上院と下院"],
    answer: 0,
    explanation: "日本の国会は衆議院と参議院の二院制です。"
  }
];

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
    playTone(880, 0, 0.25);
    playTone(1319, 0.25, 0.5);
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

  if (score === questions.length) {
    scoreMessageEl.textContent = "全問正解！お見事です！";
  } else if (score >= 3) {
    scoreMessageEl.textContent = "よくできました！";
  } else {
    scoreMessageEl.textContent = "もう一度挑戦してみましょう！";
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
