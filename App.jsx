import React, { useState, useEffect } from 'react';
import { ChevronLeft, Upload, Users, User, RefreshCcw, CheckCircle, MessageCircle, FileText, Lock, Info, Cloud, Clock, Loader2, Plus, Home } from 'lucide-react';

// =============================================================================
// 画面フローについて:
// ①イントロ（キャラクター動画 + はじめる）→ ②ツール選択 → ③ツール詳細 は全ツール共通。
// ③参加者登録 → ④分析中 → ⑤結果 は「共通点発見レーダー」専用です。
// 他ツールの③④⑤画面は追って指定するため、現時点では未割り当て（Coming Soon）。
// =============================================================================

// --- 設定 ---
// 環境変数 VITE_GEMINI_API_KEY を使用（.env に記載し、.env は .gitignore に追加すること）
// 注意: フロントのみのデプロイではキーはブラウザに含まれるため、本番ではバックエンド経由での呼び出しを推奨
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
// Gemini 3 Flash（300ドルクレジット適用中）
const GEMINI_MODEL = 'gemini-3-flash-preview';

// ツール定義（表示順: ①共通点発見レーダー ②私のトリセツメーカー ③好みアーカイブ ④関係性タイムライン ⑤５年後の未来レポート）
const TOOLS = [
  { id: 'finder', name: '共通点発見レーダー', type: '複数人プレイ', tag: '初対面ならコレ!', icon: '/icon-finder.png', desc: '共通点だけを丁寧に拾い上げ、"共通の温度感"を調査。' },
  { id: 'torisetsu', name: '私のトリセツメーカー', type: '一人プレイ', tag: '知り合いとやろう', icon: '/icon-torisetsu.png', desc: 'メンバーの強み・苦手・喜ぶ声かけをまとめます。' },
  { id: 'archive', name: '好みアーカイブ', type: '一人プレイ', tag: '友達とやろう', icon: '/icon-archive.png', desc: '時期別の好みやブームの履歴を振り返ります。' },
  { id: 'timeline', name: '関係性タイムライン', type: '一人プレイ', tag: '親友とやろう', icon: '/icon-timeline.png', desc: 'トーク相手との関係に起きた変化や転換点を年別に整理する。' },
  { id: 'future', name: '５年後の未来レポート', type: '一人プレイ', tag: '友達とやろう', icon: '/icon-future.png', desc: '成長傾向を分析し、5年後にどう進化するかを予測します。' },
];

// 好みアーカイブ: 分析結果のデフォルト（API失敗時・4件表示）
const DEFAULT_ARCHIVE_RESULTS = [
  { title: 'ぬいぐるみ時代', emoji: '🧸', period: '2023/5/05～2025/1/5', desc: '「熊のぬいぐるみかわいい」と話していた' },
  { title: 'アイドル応援時代', emoji: '⭐', period: '2024/10/24～2025/1/5', desc: '「○○くんのライブ行きたい」などの話で盛り上がった' },
  { title: '趣味嗜好', emoji: '✨', period: '期間不明', desc: '（該当する話題がありません）' },
  { title: '趣味嗜好', emoji: '✨', period: '期間不明', desc: '（該当する話題がありません）' },
];

// 分析中のアイスブレイク質問リスト
const ICEBREAK_QUESTIONS = [
  "空を飛べる、透明人間、瞬間移動など… 一つだけ特殊能力が手に入るとしたら、何を選びますか？",
  "もし一生一つのものしか食べられないとしたら、何を選びますか？",
  "明日地球が終わるとしたら、最後に誰と何をしたいですか？",
  "宝くじで3億円当たったら、まず何に使いますか？",
  "子供の頃、一番好きだった給食のメニューは？",
  "自分を動物に例えると何だと思いますか？"
];

// デフォルトの結果データ（APIエラー時や初期表示用）
const DEFAULT_RESULTS = [
  {
    title: "『場づくりの達人たち』",
    desc: "皆さんには、プロジェクトをスムーズに進めるための「場づくり」に対する高い責任感と気配りがあります！効率よりもまずは「雰囲気」を整えることが成功への近道だと、直感的に理解し合っているようです。",
    question: "仕事中によく使うアプリは？"
  },
  {
    title: "『朝活クリエイター』",
    desc: "実は全員、朝の時間を何かしらの「自己投資」や「創作」に使いたいという意欲が高いです。夜更かしよりも、朝の静けさの中にクリエイティビティの源泉を感じるタイプかもしれません。",
    question: "朝起きて最初にすることは？"
  },
  {
    title: "『ガジェット探求心』",
    desc: "新しいツールや効率化アイテムに対するアンテナ感度が共通して高いです。「もっと便利にしたい」「仕組みを変えたい」というポジティブな改善欲求が、普段の会話の端々からにじみ出ています。",
    question: "最近買ってよかったものは？"
  }
];

// --- ヘルパー関数: Gemini API呼び出し ---
const analyzeWithGemini = async (participantsData) => {
  try {
    let combinedText = "以下のチャット/テキストデータを分析してください。\n\n";
    participantsData.forEach((p, index) => {
      combinedText += `--- 参加者${index + 1}: ${p.name} ---\n${p.textData.substring(0, 3000)}\n\n`;
    });

    const prompt = `
      あなたは優秀なファシリテーターAIです。
      上記のテキストデータをもとに、参加者全員の「ポジティブな共通点」を3つ発見してください。
      特に「仕事のスキル」「ポジティブな性格」「趣味・嗜好」に焦点を当ててください。
      
      重要：分析結果（title、desc、question）には、元のテキストデータから直接引用した言葉（例：「〇〇」のような具体的な発言）を絶対に含めないでください。初対面の相手と共有することを想定し、引用されると気まずくなる可能性のある表現は避けてください。共通点は要約や言い換えで伝えてください。
      
      【質問についての重要な指示】
      questionは、初対面の人同士でも気軽に答えられるシンプルな質問にしてください。
      - 「好きな〇〇は？」「最近ハマっている〇〇は？」「おすすめの〇〇は？」のような一言で答えられる形式
      - 難しく考えなくても答えられるカジュアルな内容
      - 具体的なエピソードを求めず、シンプルに好みや最近のことを聞く
      
      出力は以下のJSON形式のみで行ってください。Markdown記法は不要です。
      
      [
        {
          "title": "短いキャッチーなタイトル（例：『隠れ美食家』）",
          "desc": "その共通点に関する詳細な分析と、なぜそれが素晴らしいかという説明（100文字程度）",
          "question": "シンプルで答えやすい質問（例：「最近ハマっている食べ物は？」「好きなお店はどこ？」）"
        },
        ...あと2つ（計3つ）
      ]
    `;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: combinedText + "\n" + prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      const errMsg = data?.error?.message || data?.error?.code || response.statusText;
      throw new Error(errMsg || 'API Error');
    }

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
      const blockReason = data.candidates?.[0]?.finishReason || data.candidates?.[0]?.safetyRatings;
      throw new Error(blockReason ? `応答がブロックされました: ${JSON.stringify(blockReason)}` : 'No response text');
    }
    return JSON.parse(resultText);

  } catch (error) {
    console.error("Analysis Failed:", error);
    throw error;
  }
};

// --- トリセツメーカー: Gemini APIで取扱説明書を生成 ---
const DEFAULT_TORISETSU_ITEM = {
  strengths: { emoji: '🚀', title: '秒速の課題解決と思いやりの両立', desc: '問題を見つけると即座に解決策を考え、行動に移します。それでいて、周りの人の気持ちを置いてきぼりにしない優しさも兼ね備えています。' },
  weaknesses: { emoji: '🌀', title: '結論のない長話と曖昧な指示', desc: '目的がはっきりしない会話は少し苦手かもしれません。具体的なゴールや要点を示してあげると、彼女の能力が最大限に発揮されます。' },
  praise: { emoji: '🌟', title: '能力を具体的に称賛', desc: '「技術がすごい」「作業が早い」と言った、具体的な能力や行動、その結果のクオリティを称賛する言葉が最も心に響きます。また、困っているときに頼られること自体に喜びを感じます。' },
  feedback: { emoji: '🎯', title: '素直かつ論理的', desc: '曖昧な表現は避け、率直で論理的な意見や具体的な改善策を好みます。成果だけでなく、その過程での努力や工夫を認められることで、さらにモチベーションが高まります。' },
};

// 共通点発見レーダーと同じモデルを使用
const GEMINI_TORISETSU_MODEL = GEMINI_MODEL;

const analyzeTorisetsuWithGemini = async (chatTextData, participantNames) => {
  if (!chatTextData || typeof chatTextData !== 'string' || chatTextData.trim().length === 0) {
    throw new Error('チャットデータがありません');
  }
  if (!participantNames?.length) {
    throw new Error('登場人物が検出されていません');
  }

  try {
    const textForAnalysis = chatTextData.substring(0, 30000);
    const namesList = participantNames.join('、');

    const prompt = `あなたは優秀なコミュニケーション分析AIです。
以下のLINEチャット（トーク）のテキストデータを分析し、登場人物それぞれについて「取り扱い説明書」を作成してください。

【対象の登場人物名】
${namesList}

【チャットデータ】
${textForAnalysis}

【指示】
上記チャットの会話内容・言い回し・反応の傾向をもとに、各登場人物について以下の4項目で取扱説明書を作成してください。

1. **得意なこと** … その人が発揮している強みや得意なこと
2. **苦手なこと** … その人が苦手にしていることや、周囲が配慮するとよいこと
3. **嬉しい頼まれごと・褒められ方** … どんな頼まれごとや褒め言葉が心に響くか
4. **好ましいフィードバックの仕方** … 建設的なフィードバックをどう伝えるとよいか

【フォーマット（厳守）】
- **絵文字**：各項目の内容を象徴する絵文字を1つ必ず付けてください（emoji フィールド）。
- **見出し**：各項目に20字以内のキャッチーな見出し（キャッチコピー）を引用符なしで作成してください（title フィールド）。例：秒速の課題解決と思いやりの両立
- **補足説明**：各項目に120字程度の補足説明を作成してください（desc フィールド）。内容が飛躍しつつも、4項目全体が一つのストーリーとして辻褄が合うように、その人らしさが伝わる流れで書いてください。
- 出力は必ず指定されたJSONスキーマに従ってください。

【重要】
- 分析結果には、元のチャットから直接引用した発言や固有名詞をそのまま含めないでください。要約・言い換えで表現してください。
- 登場人物の数だけ、配列にオブジェクトを1つずつ含めてください。各オブジェクトの "name" は【対象の登場人物名】のいずれかと完全に一致させてください。

【出力形式】JSONのみを出力してください。Markdownのコードブロックは不要です。
[
  {
    "name": "登場人物名（チャットに登場する名前そのまま）",
    "strengths": { "emoji": "絵文字1文字", "title": "20字以内の見出し", "desc": "120字程度の説明" },
    "weaknesses": { "emoji": "絵文字1文字", "title": "20字以内の見出し", "desc": "120字程度の説明" },
    "praise": { "emoji": "絵文字1文字", "title": "20字以内の見出し", "desc": "120字程度の説明" },
    "feedback": { "emoji": "絵文字1文字", "title": "20字以内の見出し", "desc": "120字程度の説明" }
  }
]
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TORISETSU_MODEL}:generateContent?key=${API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || data?.error?.code || response.statusText;
      console.error('Gemini API Error:', data);
      throw new Error(errMsg || 'API Error');
    }

    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
      const blockReason = data.candidates?.[0]?.finishReason || data.candidates?.[0]?.safetyRatings;
      console.error('Gemini No text in response:', data);
      throw new Error(blockReason ? `応答がブロックされました: ${JSON.stringify(blockReason)}` : 'No response text');
    }

    resultText = resultText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(resultText);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Invalid format');

    return parsed.map((person) => ({
      name: person.name || '不明',
      strengths: {
        emoji: person.strengths?.emoji ?? '📝',
        title: person.strengths?.title ?? DEFAULT_TORISETSU_ITEM.strengths.title,
        desc: person.strengths?.desc ?? DEFAULT_TORISETSU_ITEM.strengths.desc,
      },
      weaknesses: {
        emoji: person.weaknesses?.emoji ?? '🌀',
        title: person.weaknesses?.title ?? DEFAULT_TORISETSU_ITEM.weaknesses.title,
        desc: person.weaknesses?.desc ?? DEFAULT_TORISETSU_ITEM.weaknesses.desc,
      },
      praise: {
        emoji: person.praise?.emoji ?? '🌟',
        title: person.praise?.title ?? DEFAULT_TORISETSU_ITEM.praise.title,
        desc: person.praise?.desc ?? DEFAULT_TORISETSU_ITEM.praise.desc,
      },
      feedback: {
        emoji: person.feedback?.emoji ?? '🎯',
        title: person.feedback?.title ?? DEFAULT_TORISETSU_ITEM.feedback.title,
        desc: person.feedback?.desc ?? DEFAULT_TORISETSU_ITEM.feedback.desc,
      },
    }));
  } catch (error) {
    console.error('Torisetsu Analysis Failed:', error);
    return participantNames.map((name) => ({
      name,
      ...DEFAULT_TORISETSU_ITEM,
    }));
  }
};

// 好みアーカイブ: チャットから「共通の趣味嗜好・期間・30字以内の説明」を分析
const GEMINI_ARCHIVE_MODEL = GEMINI_MODEL;

const analyzeArchiveWithGemini = async (chatTextData, participantNames) => {
  if (!chatTextData || typeof chatTextData !== 'string' || chatTextData.trim().length === 0) {
    throw new Error('チャットデータがありません');
  }
  if (!participantNames?.length) {
    throw new Error('登場人物が検出されていません');
  }

  const textForAnalysis = chatTextData.substring(0, 20000);
  const namesList = participantNames.join('、');

  const prompt = `あなたは優秀なコミュニケーション分析AIです。
以下のLINEチャットのテキストデータを分析し、**推しているもの**と**熱量を持って語られている事柄**を、具体的に抜き出してください。分析は**3分以内**に終わるよう、簡潔に処理してください。

【チャットデータ】
${textForAnalysis}

【抽出するもの】
1. **推しているもの** … アイドル、キャラクター、作品、アーティスト、ブランドなど。固有名詞で。
2. **熱量を持って語られている事柄** … 盛り上がっている会話で、感情やこだわりが伝わる話題。固有名詞や具体的な言い回しで。

【指示】
- **4件以上**出力してください。該当する話題が多ければ5件以上・最大10件程度まで出力してよい。少ない場合のみ4件に揃えてください。
- **title**: 推しているもの、または熱量を持って語られている事柄を**固有名詞**で（キャラ名、作品名、アーティスト名など）。
- **emoji**: その話題を象徴する**絵文字1文字**。例：音楽→🎵、キャラ→🧸、アイドル→⭐、ゲーム→🎮、映画→🎬 など。
- **period**: その話題が話されていた**ある日**の日付。「YYYY/MM/DD」でその日1日を指定。
- **desc**: **ある日のセリフを限定的に抜き出す**。その日に実際に交わされた発言を「」付きで引用。60字程度まで。

【出力形式】JSONの配列のみ。Markdownのコードブロックは不要。4件以上、最大10件程度。
[
  { "title": "固有名詞", "emoji": "🎵", "period": "YYYY/MM/DD", "desc": "その日のセリフを「」で抜き出したもの" },
  ...
]

【絶対に含めないもの・結果から消去すること】
- **写真・動画・通話・端末・スタンプ** … LINEのシステム表記やメディア種別は抽出しない。
- **会話の登場人物の名前** … 実名・ニックネームは分析結果の title や desc に**一切含めず消去**してください。
- **「友だち」「トーク履歴」** … これらの語は分析結果に**含めず消去**してください。

【重要】
- title と desc に、登場人物の名前・「友だち」・「トーク履歴」を書かないこと。結果は匿名化し、誰との会話か特定されないようにすること。
- 抽象的にならないこと。desc はある日のセリフを限定的に抜き出した具体的な引用にすること。`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_ARCHIVE_MODEL}:generateContent?key=${API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || data?.error?.code || response.statusText;
      console.error('Gemini Archive API Error:', data);
      throw new Error(errMsg || 'API Error');
    }

    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
      const blockReason = data.candidates?.[0]?.finishReason || data.candidates?.[0]?.safetyRatings;
      console.error('Gemini Archive No text:', data);
      throw new Error(blockReason ? `応答がブロックされました: ${JSON.stringify(blockReason)}` : 'No response text');
    }

    resultText = resultText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(resultText);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Invalid format');

    const excludeTitles = /^(写真|動画|通話|端末|スタンプ|ビデオ通話|音声|位置情報|アルバム)$/i;
    let filtered = parsed.filter((item) => {
      const t = String(item.title || '').trim();
      return t && !excludeTitles.test(t);
    });

    const stripFromText = (text, names) => {
      let s = String(text);
      names.forEach((name) => {
        if (name && name.trim()) s = s.split(name.trim()).join('');
      });
      s = s.split('友だち').join('').split('友達').join('').split('トーク履歴').join('');
      return s.trim().replace(/\s{2,}/g, ' ');
    };

    const defaultEmoji = '✨';
    const toSingleEmoji = (v) => (v && String(v).trim().length > 0 ? String(v).trim().slice(0, 2) : defaultEmoji);

    filtered = filtered.map((item) => ({
      title: stripFromText(item.title || '趣味嗜好', participantNames).slice(0, 50) || '趣味嗜好',
      emoji: toSingleEmoji(item.emoji),
      period: String(item.period || '期間不明').slice(0, 40),
      desc: stripFromText(item.desc || '', participantNames).slice(0, 80),
    })).filter((item) => (item.title && item.desc));

    const items = filtered.slice(0, 15).map((item) => ({
      title: item.title.slice(0, 50),
      emoji: item.emoji || defaultEmoji,
      period: item.period,
      desc: item.desc.slice(0, 80),
    }));

    while (items.length < 4) {
      items.push({
        title: '趣味嗜好',
        emoji: '✨',
        period: '期間不明',
        desc: '（該当する話題がありません）',
      });
    }
    return items;
  } catch (error) {
    console.error('Archive Analysis Failed:', error);
    throw error;
  }
};

// --- サブコンポーネント定義 ---

// 左下固定の戻るボタン（ヘッダーなしレイアウト用）
const BACK_ICON_SRC = '/icon-back.svg';

const BackButton = ({ screen, goBack }) => {
  if (screen === 'intro' || screen === 'selection') return null;
  return (
    <button
      onClick={goBack}
      className="fixed bottom-6 left-6 z-50 w-[60px] h-[60px] flex items-center justify-center rounded-full shadow-xl hover:scale-105 active:scale-95 transition-transform focus:outline-none"
      aria-label="戻る"
    >
      <img src={BACK_ICON_SRC} alt="" className="w-full h-full object-contain" />
    </button>
  );
};

// 右下固定のルールボタン（ツール詳細画面以降で表示）
const RULE_BUTTON_SRC = '/button_rule.png';

const RuleButton = ({ screen, onOpenRule }) => {
  const show = screen === 'details' || screen === 'input' || screen === 'analyzing' || screen === 'results' || screen === 'torisetsuResults' || screen === 'archiveAnalyzing' || screen === 'archiveResults';
  if (!show) return null;
  return (
    <button
      onClick={onOpenRule}
      className="fixed bottom-6 right-6 z-50 w-[60px] h-[60px] flex items-center justify-center rounded-full shadow-xl hover:scale-105 active:scale-95 transition-transform focus:outline-none"
      aria-label="ルールを確認"
    >
      <img src={RULE_BUTTON_SRC} alt="" className="w-full h-full object-contain" />
    </button>
  );
};

// ルール確認モーダル（開いているツールのルールを表示・一番下にホームへ戻る）
const RuleModal = ({ selectedTool, onClose, onGoHome }) => {
  const toolId = selectedTool?.id || 'finder';

  const renderRuleContent = () => {
    if (toolId === 'finder') {
      return (
        <>
          <div className="flex justify-center gap-4 text-sm font-bold text-gray-500">
            <span className="bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1"><Clock size={14}/> 5～10分</span>
            <span className="bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1"><Users size={14}/> 2～10人</span>
          </div>
          <section>
            <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
              <span className="bg-[#3986BB] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
              見せたい共通点
            </h4>
            <p className="text-xs leading-relaxed mb-2 text-gray-600">仕事のスキルやポジティブな趣味など、みんなに「知ってほしい」と思える長所を中心に共通点を探します。</p>
            <div className="bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden p-[21px]">
              <p className="text-[10px] text-[var(--black-mid)] font-bold mb-2">分析結果の例</p>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={18} className="text-[var(--blue-500)] shrink-0" />
                <h3 className="text-sm font-bold text-[var(--black-dark)]">共通点 1</h3>
              </div>
              <div className="mb-3">
                <h4 className="font-bold text-[var(--black-dark)] text-sm mb-0.5">{DEFAULT_RESULTS[0].title}</h4>
                <p className="text-xs text-[var(--black-mid)] leading-relaxed">{DEFAULT_RESULTS[0].desc}</p>
              </div>
              <div className="flex justify-center my-2">
                <div className="bg-white border-2 border-[var(--blue-500)] rounded-[24px] px-4 py-2 shadow-lg inline-block">
                  <p className="text-[10px] text-[var(--black-mid)] text-center mb-0.5">最初の回答者</p>
                  <p className="text-sm font-bold text-[var(--black-dark)] text-center">イチオカミズキ さん</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-3 shadow-lg">
                <p className="text-[10px] text-[var(--black-mid)] font-bold mb-1">Q 1.</p>
                <p className="text-xs text-[var(--black-dark)] leading-relaxed">{DEFAULT_RESULTS[0].question}</p>
              </div>
            </div>
          </section>
          <section>
            <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
              <span className="bg-[#3986BB] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
              指名された人から話す
            </h4>
            <p className="text-xs leading-relaxed text-gray-600">カードごとに「最初の回答者」が指名されます。その人から時計回りに話してみましょう！</p>
          </section>
          <section>
            <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
              <span className="bg-[#3986BB] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">3</span>
              脱線は大歓迎！
            </h4>
            <p className="text-xs leading-relaxed text-gray-600">盛り上がって話が脱線してきたら、場があったまってきた証拠。</p>
          </section>
        </>
      );
    }
    if (toolId === 'torisetsu') {
      return (
        <>
          <div className="flex justify-center gap-4 text-sm font-bold text-gray-500">
            <span className="bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1"><Clock size={14}/> 3～5分</span>
            <span className="bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1"><Users size={14}/> 1人</span>
          </div>
          <section>
            <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
              <span className="bg-[#3986BB] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
              データを投入する
            </h4>
            <p className="text-xs leading-relaxed text-gray-600">チャットデータを投入すると、チャットの登場人物を自動で検出します。</p>
          </section>
          <section>
            <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
              <span className="bg-[#3986BB] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
              分析結果を見てお互いの理解を深める
            </h4>
            <p className="text-xs leading-relaxed mb-2 text-gray-600">分析結果はチャットの登場人数分のページを生成します。</p>
          </section>
          <div className="pt-2">
            <p className="text-[10px] text-[var(--black-mid)] font-bold mb-3">分析結果の例</p>
            <section className="mb-4">
              <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2"><span className="text-lg">📝</span>得意なこと</h4>
              <div className="bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden p-[21px]">
                <h4 className="font-bold text-[var(--black-dark)] text-sm mb-0.5">🚀 秒速の課題解決と思いやりの両立</h4>
                <p className="text-xs text-[var(--black-mid)] leading-relaxed">問題を見つけると即座に解決策を考え、行動に移します。それでいて、周りの人の気持ちを置いてきぼりにしない優しさも兼ね備えています。</p>
              </div>
            </section>
            <section className="mb-4">
              <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2"><span className="text-lg">🌀</span>苦手なこと</h4>
              <div className="bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden p-[21px]">
                <h4 className="font-bold text-[var(--black-dark)] text-sm mb-0.5">🌀 結論のない長話と曖昧な指示</h4>
                <p className="text-xs text-[var(--black-mid)] leading-relaxed">目的がはっきりしない会話は少し苦手かもしれません。具体的なゴールや要点を示してあげると、彼女の能力が最大限に発揮されます。</p>
              </div>
            </section>
            <section className="mb-4">
              <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2"><span className="text-lg">🌟</span>嬉しい頼まれごと・褒められ方</h4>
              <div className="bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden p-[21px]">
                <h4 className="font-bold text-[var(--black-dark)] text-sm mb-0.5">🌟 能力を具体的に称賛</h4>
                <p className="text-xs text-[var(--black-mid)] leading-relaxed">「技術がすごい」「作業が早い」と言った、具体的な能力や行動、その結果のクオリティを称賛する言葉が最も心に響きます。</p>
              </div>
            </section>
            <section>
              <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2"><span className="text-lg">🎯</span>好ましいフィードバックの仕方</h4>
              <div className="bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden p-[21px]">
                <h4 className="font-bold text-[var(--black-dark)] text-sm mb-0.5">🎯 素直かつ論理的</h4>
                <p className="text-xs text-[var(--black-mid)] leading-relaxed">曖昧な表現は避け、率直で論理的な意見や具体的な改善策を好みます。成果だけでなく、その過程での努力や工夫を認められることで、さらにモチベーションが高まります。</p>
              </div>
            </section>
          </div>
        </>
      );
    }
    if (toolId === 'archive') {
      return (
        <>
          <div className="flex justify-center gap-4 text-sm font-bold text-gray-500">
            <span className="bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1"><Clock size={14}/> 3分</span>
            <span className="bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1"><Users size={14}/> 1人</span>
          </div>
          <section>
            <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
              <span className="bg-[#3986BB] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
              データを投入する
            </h4>
            <p className="text-xs leading-relaxed text-gray-600">趣味の話をしている友人や家族とのLINEチャットデータを用意します。</p>
          </section>
          <section>
            <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
              <span className="bg-[#3986BB] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
              趣味の移り変わりを歴史年表にする
            </h4>
            <p className="text-xs leading-relaxed mb-2 text-gray-600">会話相手と自分の趣味嗜好がどのように移り変わってきたかを順を追って明らかにします。</p>
            <div className="bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden p-[21px]">
              <p className="text-[10px] text-[var(--black-mid)] font-bold mb-2">分析結果の例</p>
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-[var(--black-dark)] text-sm mb-0.5">ぬいぐるみ時代</h4>
                  <p className="text-xs text-[var(--black-mid)] mb-1">2023/5/05～2025/1/5</p>
                  <p className="text-xs text-[var(--black-mid)] leading-relaxed">🚀 熊のぬいぐるみをこよなく愛した</p>
                </div>
                <div>
                  <h4 className="font-bold text-[var(--black-dark)] text-sm mb-0.5">アイドル応援時代</h4>
                  <p className="text-xs text-[var(--black-mid)] mb-1">2024/10/24～2025/1/5</p>
                  <p className="text-xs text-[var(--black-mid)] leading-relaxed">🌀 ○○くん、○○くんなどの話で盛り上がった</p>
                </div>
              </div>
            </div>
          </section>
        </>
      );
    }
    // 関係性タイムライン・５年後の未来レポート
    return (
      <div className="py-4 text-center">
        <p className="text-sm text-gray-500">このツールのルールは準備中です。</p>
      </div>
    );
  };

  const ruleTitle = selectedTool ? `${selectedTool.name} ルール` : 'ルール';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white/95 backdrop-blur-md rounded-[32px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] max-w-md w-full max-h-[calc(85vh+20px)] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="pt-8 px-5 pb-2 relative flex items-center justify-center shrink-0">
          <h2 className="text-lg font-bold text-[#134E78] text-center">{ruleTitle}</h2>
          <button onClick={onClose} className="absolute right-5 top-1/2 -translate-y-1/2 p-2 -m-2 rounded-full hover:bg-black/5 text-[var(--black-mid)]" aria-label="閉じる">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-[40px] pt-7 space-y-4 text-gray-700">
          {renderRuleContent()}
        </div>
        <div className="shrink-0 p-5 pt-4 pb-6 border-t border-gray-200/80">
          <button
            type="button"
            onClick={onGoHome}
            className="w-full h-12 rounded-full font-bold text-white bg-[var(--blue-500)] hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Home size={20} />
            <span>ホームへ戻る</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ① イントロ画面（ロゴ + キャラクターGIF + はじめるボタン・背景透過）
const INTRO_LOGO_SRC = '/logo.png';
const INTRO_GIF_SRC = '/intro.gif';
const INTRO_BUTTON_SRC = '/button-hazimeru.svg';

const IntroScreen = ({ setScreen }) => (
  <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-transparent">
    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md bg-transparent">
      <img
        src={INTRO_LOGO_SRC}
        alt="wordig"
        className="w-full max-w-[280px] object-contain bg-transparent mb-6"
      />
      <img
        src={INTRO_GIF_SRC}
        alt="くもぐら"
        className="w-full max-h-[40vh] object-contain bg-transparent"
      />
      <button
        type="button"
        onClick={() => setScreen('selection')}
        className="mt-8 w-full max-w-[198px] hover:opacity-90 active:scale-95 transition-all focus:outline-none"
        aria-label="はじめる"
      >
        <img src={INTRO_BUTTON_SRC} alt="はじめる" className="w-full h-auto object-contain" />
      </button>
    </div>
  </div>
);

// ② ツール選択画面（左アイコン・右説明・スマホ画面いっぱい）
const SelectionScreen = ({ setSelectedTool, setScreen }) => (
  <div className="flex flex-col min-h-screen w-full max-w-lg mx-auto">
    <h2 className="text-lg font-bold text-gray-700 py-4 px-4 text-center shrink-0">使いたいツールを選んでね</h2>
    <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
      {TOOLS.map((tool) => (
        <div
          key={tool.id}
          onClick={() => { setSelectedTool(tool); setScreen('details'); }}
          className="flex items-stretch gap-4 bg-white/20 backdrop-blur-sm rounded-[30px] shadow-1 p-4 min-h-[100px] cursor-pointer hover:opacity-95 active:scale-[0.99] transition-all"
        >
          {/* 左: アイコン（sizi_torisetsu.svg 準拠・角丸20・背景なし） */}
          <div className="w-[45%] max-w-[160px] shrink-0 flex items-center justify-center">
            <div className="aspect-square w-full max-h-[130px] rounded-[20px] flex items-center justify-center overflow-hidden">
              <img src={tool.icon} alt="" className="w-full h-full object-contain" />
            </div>
          </div>
          {/* 右: ピル（複数人プレイ/一人プレイ）→ タイトル → 説明文 */}
          <div className="flex-1 min-w-0 flex flex-col justify-center py-1 gap-1.5">
            {tool.type && (
              <span className="inline-flex items-center text-xs font-medium text-[var(--blue-500)] bg-white border border-[var(--blue-500)] px-3 py-1 rounded-[12px] w-fit">
                {tool.type}
              </span>
            )}
            <h3 className="font-bold text-[#134E78] text-base leading-tight">{tool.name}</h3>
            {tool.desc && (
              <p className="text-xs text-[var(--black-mid)] leading-relaxed">{tool.desc}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ② ツールの詳細画面（画面全体スクロール・ルールボタン・戻るボタンは固定）
const DetailsScreen = ({ selectedTool, setScreen }) => {
  const isFinder = selectedTool?.id === 'finder';
  const isTorisetsu = selectedTool?.id === 'torisetsu';
  const isArchive = selectedTool?.id === 'archive';

  return (
    <div className="p-6 pb-24 overflow-y-auto min-h-screen flex flex-col items-center">
      <div className="bg-white/20 backdrop-blur-md p-8 rounded-[40px] shadow-xl max-w-md w-full relative">
        <div className="flex justify-center mb-6">
          <div className="rounded-3xl flex items-center justify-center overflow-hidden">
            <img src={selectedTool?.icon} alt="" className="w-32 h-32 object-contain" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-[#134E78] mb-6">{selectedTool?.name}</h2>
        
        {isFinder ? (
          <div className="space-y-6 text-gray-700">
            <div className="flex justify-center gap-4 text-sm font-bold text-gray-500">
               <span className="bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1"><Clock size={14}/> 5～10分</span>
               <span className="bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1"><Users size={14}/> 2～10人</span>
            </div>

            <button 
              onClick={() => setScreen('input')}
              className="w-full h-14 min-h-[56px] bg-[var(--blue-500)] hover:opacity-90 text-white font-bold rounded-full flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Users size={20} />
              <span>みんなでプレイ</span>
              <ChevronLeft size={20} className="rotate-180 shrink-0" />
            </button>

            <div className="space-y-4">
              <h3 className="font-bold text-[#134E78] text-base mt-2">詳細説明</h3>

              <section>
                <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
                  <span className="bg-[#3986BB] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
                  複数のLINEチャットデータを１台のデバイスに集める
                </h4>
                <p className="text-xs leading-relaxed mb-2 text-gray-600">
                  参加者はテキストデータを一人一つずつ保存し、AirdropやLINEなどを介して代表の一人のデバイスに送信して集めます。参加者の名前とテキストデータを入力します。
                </p>
              </section>

              <section>
                <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
                  <span className="bg-[#3986BB] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
                  見せたい共通点
                </h4>
                <p className="text-xs leading-relaxed mb-2 text-gray-600">
                  仕事のスキルやポジティブな趣味など、みんなに「知ってほしい」と思える長所を中心に共通点を探します。
                </p>
                <div className="bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden p-[21px]">
                  <p className="text-[10px] text-[var(--black-mid)] font-bold mb-2">分析結果の例</p>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={18} className="text-[var(--blue-500)] shrink-0" />
                    <h3 className="text-sm font-bold text-[var(--black-dark)]">共通点 1</h3>
                  </div>
                  <div className="mb-3">
                    <h4 className="font-bold text-[var(--black-dark)] text-sm mb-0.5">{DEFAULT_RESULTS[0].title}</h4>
                    <p className="text-xs text-[var(--black-mid)] leading-relaxed">{DEFAULT_RESULTS[0].desc}</p>
                  </div>
                  <div className="flex justify-center my-2">
                    <div className="bg-white border-2 border-[var(--blue-500)] rounded-[24px] px-4 py-2 shadow-lg inline-block">
                      <p className="text-[10px] text-[var(--black-mid)] text-center mb-0.5">最初の回答者</p>
                      <p className="text-sm font-bold text-[var(--black-dark)] text-center">イチオカミズキ さん</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-3 shadow-lg">
                    <p className="text-[10px] text-[var(--black-mid)] font-bold mb-1">Q 1.</p>
                    <p className="text-xs text-[var(--black-dark)] leading-relaxed">{DEFAULT_RESULTS[0].question}</p>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
                  <span className="bg-[#3986BB] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">3</span>
                  指名された人から話す
                </h4>
                <p className="text-xs leading-relaxed text-gray-600">
                  カードごとに「最初の回答者」が指名されます。その人から時計回りに話してみましょう！
                </p>
              </section>

              <section>
                <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
                  <span className="bg-[#3986BB] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">4</span>
                  脱線は大歓迎！
                </h4>
                <p className="text-xs leading-relaxed text-gray-600">
                  盛り上がって話が脱線してきたら、場があったまってきた証拠。
                </p>
              </section>
            </div>
          </div>
        ) : isTorisetsu ? (
          <div className="space-y-6 text-gray-700">
            <div className="flex justify-center gap-4 text-sm font-bold text-gray-500">
               <span className="bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1"><Clock size={14}/> 3～5分</span>
               <span className="bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1"><Users size={14}/> 1人</span>
            </div>

            <button 
              onClick={() => setScreen('input')}
              className="w-full h-14 min-h-[56px] bg-[var(--blue-500)] hover:opacity-90 text-white font-bold rounded-full flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <User size={20} />
              <span>一人でプレイ</span>
              <ChevronLeft size={20} className="rotate-180 shrink-0" />
            </button>

            <div className="space-y-4">
              <h3 className="font-bold text-[#134E78] text-base mt-2">詳細説明</h3>

              <section>
                <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
                  <span className="bg-[#3986BB] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
                  データを投入する
                </h4>
                <p className="text-xs leading-relaxed text-gray-600">
                  チャットデータを投入すると、チャットの登場人物を自動で検出します。
                </p>
              </section>

              <section>
                <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
                  <span className="bg-[#3986BB] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
                  分析結果を見てお互いの理解を深める
                </h4>
                <p className="text-xs leading-relaxed mb-2 text-gray-600">
                  分析結果はチャットの登場人数分のページを生成します。
                </p>
              </section>

              <div className="pt-2">
                <p className="text-[10px] text-[var(--black-mid)] font-bold mb-3">分析結果の例</p>
                
                <section className="mb-4">
                  <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
                    <span className="text-lg">📝</span>
                    得意なこと
                  </h4>
                  <div className="bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden p-[21px] mb-3">
                    <div className="mb-3">
                      <h4 className="font-bold text-[var(--black-dark)] text-sm mb-0.5">🚀 秒速の課題解決と思いやりの両立</h4>
                      <p className="text-xs text-[var(--black-mid)] leading-relaxed">問題を見つけると即座に解決策を考え、行動に移します。それでいて、周りの人の気持ちを置いてきぼりにしない優しさも兼ね備えています。</p>
                    </div>
                  </div>
                </section>

                <section className="mb-4">
                  <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
                    <span className="text-lg">🌀</span>
                    苦手なこと
                  </h4>
                  <div className="bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden p-[21px] mb-3">
                    <div className="mb-3">
                      <h4 className="font-bold text-[var(--black-dark)] text-sm mb-0.5">🌀 結論のない長話と曖昧な指示</h4>
                      <p className="text-xs text-[var(--black-mid)] leading-relaxed">目的がはっきりしない会話は少し苦手かもしれません。具体的なゴールや要点を示してあげると、彼女の能力が最大限に発揮されます。</p>
                    </div>
                  </div>
                </section>

                <section className="mb-4">
                  <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
                    <span className="text-lg">🌟</span>
                    嬉しい頼まれごと・褒められ方
                  </h4>
                  <div className="bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden p-[21px] mb-3">
                    <div className="mb-3">
                      <h4 className="font-bold text-[var(--black-dark)] text-sm mb-0.5">🌟 能力を具体的に称賛</h4>
                      <p className="text-xs text-[var(--black-mid)] leading-relaxed">「技術がすごい」「作業が早い」と言った、具体的な能力や行動、その結果のクオリティを称賛する言葉が最も心に響きます。</p>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
                    <span className="text-lg">🎯</span>
                    好ましいフィードバックの仕方
                  </h4>
                  <div className="bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden p-[21px]">
                    <div className="mb-3">
                      <h4 className="font-bold text-[var(--black-dark)] text-sm mb-0.5">🎯 素直かつ論理的</h4>
                      <p className="text-xs text-[var(--black-mid)] leading-relaxed">曖昧な表現は避け、率直で論理的な意見や具体的な改善策を好みます。成果だけでなく、その過程での努力や工夫を認められることで、さらにモチベーションが高まります。</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        ) : isArchive ? (
          <div className="space-y-6 text-gray-700">
            <div className="flex justify-center gap-4 text-sm font-bold text-gray-500">
              <span className="bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1"><Clock size={14}/> 3分</span>
              <span className="bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1"><Users size={14}/> 1人</span>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-[#134E78] text-base mt-2">詳細説明</h3>

              <section>
                <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
                  <span className="bg-[#3986BB] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
                  データを投入する
                </h4>
                <p className="text-xs leading-relaxed text-gray-600">趣味の話をしている友人や家族とのLINEチャットデータを用意します。</p>
              </section>

              <section>
                <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
                  <span className="bg-[#3986BB] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
                  趣味の移り変わりを歴史年表にする
                </h4>
                <p className="text-xs leading-relaxed mb-2 text-gray-600">会話相手と自分の趣味嗜好がどのように移り変わってきたかを順を追って明らかにします。</p>
                <div className="bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden p-[21px]">
                  <p className="text-[10px] text-[var(--black-mid)] font-bold mb-2">分析結果の例</p>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-bold text-[var(--black-dark)] text-sm mb-0.5">ぬいぐるみ時代</h4>
                      <p className="text-xs text-[var(--black-mid)] mb-1">2023/5/05～2025/1/5</p>
                      <p className="text-xs text-[var(--black-mid)] leading-relaxed">🚀 熊のぬいぐるみをこよなく愛した</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--black-dark)] text-sm mb-0.5">アイドル応援時代</h4>
                      <p className="text-xs text-[var(--black-mid)] mb-1">2024/10/24～2025/1/5</p>
                      <p className="text-xs text-[var(--black-mid)] leading-relaxed">🌀 ○○くん、○○くんなどの話で盛り上がった</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <button
              onClick={() => setScreen('input')}
              className="w-full h-14 min-h-[56px] bg-[var(--blue-500)] hover:opacity-90 text-white font-bold rounded-full flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <User size={20} />
              <span>一人でプレイ</span>
              <ChevronLeft size={20} className="rotate-180 shrink-0" />
            </button>
          </div>
        ) : (
          <div className="space-y-6 text-gray-700 text-center">
            <div className="bg-gray-50 p-4 rounded-2xl">
              <p className="text-sm text-gray-500">このツールは現在準備中です。</p>
            </div>
            <div className="w-full bg-gray-200 text-gray-400 font-bold py-4 rounded-full flex items-center justify-center gap-2 cursor-not-allowed">
              <Lock size={18} />
              <span className="text-sm">Coming Soon...</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// 登場人物として妥当な名前かどうかを判定（数字・時刻・システム表記を除外）
const isValidParticipantName = (name) => {
  if (!name || typeof name !== 'string') return false;
  const n = name.trim();
  if (n.length === 0 || n.length > 35) return false;
  // 数字だけ（例: 22, 25, 49）は除外
  if (/^\d+$/.test(n)) return false;
  // 時刻っぽい（例: 49:21, 22:00）は除外
  if (/^\d{1,2}:\d{2}$/.test(n)) return false;
  if (/^\d{1,2}:\d{2}.+/.test(n)) return false;
  // LINEのシステム表記は除外
  if (/^\[(スタンプ|写真|アルバム|動画|音声|位置情報|ビデオ通話|通話)/i.test(n)) return false;
  if (/^\(null\)$/i.test(n)) return false;
  // システムメッセージの本文が名前欄に入ったもの（「〇〇が〇〇をグループに追加」など）は除外
  if (/が/.test(n) && (/追加|変更|をグループ/.test(n))) return false;
  return true;
};

// ヘルパー関数: LINEトーク履歴から登場人物を抽出（LINE形式のみ・厳密）
// 形式1: "21:38 みずき スタンプ" … 時刻＋スペース＋名前＋スペース＋メッセージ（スペース区切り）
// 形式2: "08:39	かずはちゃん0916	2人とも京阪？" … 時刻＋TAB＋名前＋TAB＋メッセージ
const detectParticipants = (textData) => {
  const participants = new Set();
  const lines = textData.split(/\r?\n/);
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed.startsWith('[LINE]') || trimmed.startsWith('保存日時：')) continue;
    if (/^\d{4}\.\d{1,2}\.\d{1,2}\s/.test(trimmed)) continue;
    if (/^\d{4}\/\d{1,2}\/\d{1,2}\([月火水木金土日]\)\s*$/.test(trimmed)) continue;
    
    // 形式1: 時刻＋スペース＋名前＋スペース＋（メッセージ）
    const match1 = trimmed.match(/^\d{1,2}:\d{2}\s+([^\s]+)\s+/);
    if (match1 && match1[1] && isValidParticipantName(match1[1])) {
      participants.add(match1[1].trim());
      continue;
    }
    
    // 形式2: 時刻＋TAB＋名前＋TAB＋（メッセージ）
    const match2 = trimmed.match(/^\d{1,2}:\d{2}\t([^\t]+)\t/);
    if (match2 && match2[1] && isValidParticipantName(match2[1])) {
      participants.add(match2[1].trim());
    }
  }
  
  return Array.from(participants);
};

// ヘルパー関数: Geminiでテキストから登場人物名を抽出（検出0人時のフォールバック）
const extractParticipantsWithGemini = async (textData) => {
  const textForAnalysis = (textData || '').trim().substring(0, 15000);
  if (!textForAnalysis) return [];

  const prompt = `あなたはLINEなどのチャット履歴を分析する専門家です。
以下のテキストは「時刻・発言者名・メッセージ」の形式（タブまたはスペース区切り）のチャット履歴です。
「発言者名」として実際に登場している表示名・ニックネームだけを抽出してください。

【厳守ルール】
- 抽出するのは「誰が話したか」の名前だけ。メッセージ本文中の数字・単語・URL・時刻は絶対に含めない
- 例：時刻「22:00」、数字「25」「49」、本文の単語「スタンプ」「画像」は含めない
- [スタンプ][写真][アルバム][動画] などのシステム表記は含めない
- 敬称（さん、くん等）は除いた名前で返す（例：「田中さん」→「田中」）
- 同じ人物は1回だけ。2人以上30人以下で返す

【テキスト】
${textForAnalysis}

【出力形式】JSONの配列のみ。Markdownのコードブロックは不要。
["名前1", "名前2", ...]
`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TORISETSU_MODEL}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'API Error');

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) throw new Error('No response text');

    const raw = resultText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(raw);
    let names = Array.isArray(parsed) ? parsed.filter(n => typeof n === 'string' && n.trim().length > 0).map(n => n.trim()) : [];
    // AIの返答も数字・時刻・システム表記は除外
    names = names.filter(isValidParticipantName);
    return names.slice(0, 30);
  } catch (error) {
    console.error('extractParticipantsWithGemini failed:', error);
    return [];
  }
};

// ③ 共通点発見レーダー専用: チャットデータ入力画面（初期2名・最大10名）
const MAX_PARTICIPANTS = 10;
const PLACEHOLDERS = ['やまだはなこ', 'さとうけんた', 'たなかとおる', 'やまもとここな', '参加者5', '参加者6', '参加者7', '参加者8', '参加者9', '参加者10'];

const InputScreen = ({ participants, setParticipants, startAnalysis, canGoNext }) => {
  const handleFileChange = (e, index) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const textData = event.target.result;
        const newP = [...participants];
        newP[index].fileName = file.name;
        newP[index].textData = textData;
        setParticipants(newP);
      };
      reader.readAsText(file);
    }
  };

  const addParticipant = () => {
    if (participants.length >= MAX_PARTICIPANTS) return;
    const nextId = Math.max(...participants.map((p) => p.id), 0) + 1;
    const placeholder = PLACEHOLDERS[participants.length] ?? `参加者${participants.length + 1}`;
    setParticipants([...participants, { id: nextId, name: '', fileName: '', textData: '', placeholder }]);
  };

  const removeParticipant = (index) => {
    if (participants.length <= 2) return;
    const newP = participants.filter((_, i) => i !== index);
    setParticipants(newP);
  };

  return (
    <div className="p-6 max-w-lg mx-auto pb-28">
      <h2 className="text-xl font-bold text-gray-700 mb-2 text-center">チャットデータを投入しよう！</h2>
      <div className="flex justify-center mb-6">
        <img src="/kumogura-shippo.gif" alt="" className="max-w-full max-h-[320px] w-full object-contain rounded-xl" />
      </div>
      <p className="text-center text-gray-500 text-sm mb-8">
        参加者の名前を入力して<br />
        txtファイルをアップロードしてね！<br />
        僕が分析するよ！
      </p>
      
      <div className="space-y-5">
        {participants.map((p, idx) => (
          <div key={p.id} className="rounded-[33px] overflow-hidden shadow-md flex flex-col transition-all focus-within:ring-2 focus-within:ring-[#3986BB]/30 relative">
            {/* 背景レイヤー：入力未完了時のみ透明度20 */}
            <div className={`absolute inset-0 bg-white rounded-[33px] transition-opacity duration-300 ${p.name.trim() && p.fileName ? 'opacity-100' : 'opacity-20'}`} />
            {/* コンテンツ：名前入力・データ追加ボタンは常に不透明度100 */}
            <div className="relative p-[28px] flex flex-col gap-4">
              {/* 参加者番号: 名前入力の上 */}
              <p className="text-sm font-bold text-gray-700">参加者{String.fromCharCode(0xFF10 + idx + 1)}</p>
              {/* 名前行: 名前ピル + 削除ボタン */}
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => {
                    const newP = [...participants];
                    newP[idx].name = e.target.value;
                    setParticipants(newP);
                  }}
                  placeholder={p.placeholder}
                  className={`flex-1 h-[30px] px-4 rounded-[15px] bg-[#D4EDFF] border-0 outline-none placeholder-gray-500 text-sm ${
                    p.name ? 'font-semibold text-[#2A5E83]' : 'text-gray-800'
                  }`}
                />
                {participants.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeParticipant(idx)}
                    className="shrink-0 w-9 h-9 rounded-full border-2 border-[#3986BB] flex items-center justify-center text-[#3986BB] hover:bg-[#3986BB] hover:text-white transition-colors"
                    aria-label="この参加者を削除"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* ファイル名エリア: ボタン（左）＋ ファイル名 */}
              <div className="flex items-center gap-3 min-h-[44px]">
                <label className="cursor-pointer shrink-0 h-[30px] flex items-center justify-center hover:opacity-90 transition-opacity">
                  <img
                    src={p.fileName ? '/button_detachange.svg' : '/action_upload_file1.svg'}
                    alt={p.fileName ? 'データを変更' : 'データを追加'}
                    className="h-[30px] w-auto"
                  />
                  <input
                    type="file"
                    accept=".txt"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, idx)}
                  />
                </label>
                <div className={`flex-1 min-h-[30px] px-[28px] rounded-[15px] flex items-center justify-center gap-2`}>
                  <FileText size={16} className={p.fileName ? 'text-[#2A5E83]' : 'text-gray-400'} />
                  <span className={`text-sm truncate ${p.fileName ? 'text-[#2A5E83] font-medium' : 'text-gray-500'}`}>
                    {p.fileName || '追加されていません'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {participants.length < MAX_PARTICIPANTS && (
        <button
          type="button"
          onClick={addParticipant}
          className="mt-4 w-full py-3 rounded-full border-2 border-dashed border-blue-300 font-bold text-sm hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-[#3986BB]">+ 参加者を追加</span>
          <span className="text-xs text-gray-500">（最大{MAX_PARTICIPANTS}名まで）</span>
        </button>
      )}

      <div className="fixed bottom-6 left-0 right-0 px-6 max-w-lg mx-auto">
        <button 
          disabled={!canGoNext}
          onClick={startAnalysis}
          className={`w-full h-[60px] rounded-full font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 ${
            canGoNext 
              ? 'bg-[var(--blue-500)] hover:opacity-90 cursor-pointer' 
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {canGoNext ? (
            <>
              <span>次へ進む</span>
              <ChevronLeft size={20} className="rotate-180 shrink-0" />
            </>
          ) : (
            <span className="text-sm">2名以上のデータを登録してください</span>
          )}
        </button>
      </div>
    </div>
  );
};

// ③ トリセツメーカー専用: チャットデータ入力画面（1ファイルのみ・登場人物自動検出）
const TorisetsuInputScreen = ({ 
  chatFileName, 
  setChatFileName, 
  chatTextData, 
  setChatTextData,
  detectedParticipants,
  setDetectedParticipants,
  isDetecting,
  setIsDetecting,
  detectionProgress,
  setDetectionProgress,
  startTorisetsuAnalysis,
  canGoNextTorisetsu,
  onExtractWithAI,
  isExtractingParticipants,
  extractionError,
  setExtractionError,
}) => {
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setChatFileName(file.name);
      setIsDetecting(true);
      setDetectionProgress(0);
      if (setExtractionError) setExtractionError(null);
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        const textData = event.target.result;
        setChatTextData(textData);
        
        // プログレスバーのアニメーション
        const progressInterval = setInterval(() => {
          setDetectionProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }, 50);
        
        // 登場人物を検出
        setTimeout(() => {
          const participants = detectParticipants(textData);
          setDetectedParticipants(participants);
          clearInterval(progressInterval);
          setDetectionProgress(100);
          setTimeout(() => {
            setIsDetecting(false);
          }, 300);
        }, 800);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto pb-28">
      <h2 className="text-xl font-bold text-gray-700 mb-2 text-center">チャットデータを投入しよう！</h2>
      <div className="flex justify-center mb-6">
        <img src="/kumogura-shippo.gif" alt="" className="max-w-full max-h-[320px] w-full object-contain rounded-xl" />
      </div>
      <p className="text-center text-gray-500 text-sm mb-8">
        LINEのトークデータ（txtファイル）を<br />
        アップロードしてね！<br />
        登場人物を自動で検出するよ！
      </p>
      
      <div className="space-y-5">
        {/* チャットデータアップロードカード */}
        <div className="rounded-[33px] overflow-hidden shadow-md flex flex-col transition-all focus-within:ring-2 focus-within:ring-[#3986BB]/30 relative">
          {/* 背景レイヤー：入力未完了時のみ透明度20 */}
          <div className={`absolute inset-0 bg-white rounded-[33px] transition-opacity duration-300 ${chatFileName ? 'opacity-100' : 'opacity-20'}`} />
          
          {/* コンテンツ */}
          <div className="relative p-[28px] flex flex-col gap-4">
            <p className="text-sm font-bold text-gray-700">チャットデータ</p>
            
            {/* ファイル名エリア: ボタン（左）＋ ファイル名 */}
            <div className="flex items-center gap-3 min-h-[44px]">
              <label className="cursor-pointer shrink-0 h-[30px] flex items-center justify-center hover:opacity-90 transition-opacity">
                <img
                  src={chatFileName ? '/button_detachange.svg' : '/action_upload_file1.svg'}
                  alt={chatFileName ? 'データを変更' : 'データを追加'}
                  className="h-[30px] w-auto"
                />
                <input
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              <div className={`flex-1 min-h-[30px] px-[28px] rounded-[15px] flex items-center justify-center gap-2`}>
                <FileText size={16} className={chatFileName ? 'text-[#2A5E83]' : 'text-gray-400'} />
                <span className={`text-sm truncate ${chatFileName ? 'text-[#2A5E83] font-medium' : 'text-gray-500'}`}>
                  {chatFileName || '追加されていません'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 登場人物検出中のプログレスバー */}
        {isDetecting && (
          <div className="bg-white/90 rounded-[33px] p-6 shadow-md">
            <p className="text-sm font-bold text-gray-700 mb-3 text-center flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-[var(--blue-500)]" />
              登場人物を検出中...
            </p>
            <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden shadow-inner">
              <div
                className="bg-[var(--blue-500)] h-full transition-all duration-300 ease-out rounded-full"
                style={{ width: `${detectionProgress}%` }}
              />
            </div>
            <p className="text-right mt-1 text-xs text-[var(--blue-500)] font-mono">{detectionProgress}%</p>
          </div>
        )}

        {/* 検出された登場人物リスト */}
        {!isDetecting && detectedParticipants.length > 0 && (
          <div className="bg-white rounded-[33px] p-6 shadow-md">
            <div className="flex items-center gap-2 mb-4">
              <Users size={18} className="text-[var(--blue-500)]" />
              <p className="text-sm font-bold text-gray-700">検出された登場人物（{detectedParticipants.length}名）</p>
            </div>
            <div className="space-y-2">
              {detectedParticipants.map((name, index) => (
                <div 
                  key={index}
                  className="bg-[#D4EDFF] rounded-full px-4 py-2 text-sm font-semibold text-[#2A5E83] flex items-center gap-2 justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[var(--blue-500)] text-white text-xs flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <span className="truncate">{name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newParticipants = detectedParticipants.filter((_, i) => i !== index);
                      setDetectedParticipants(newParticipants);
                    }}
                    className="shrink-0 w-7 h-7 rounded-full border-2 border-[#3986BB] flex items-center justify-center text-[#3986BB] hover:bg-[#3986BB] hover:text-white transition-colors text-base leading-none"
                    aria-label={`${name}を削除`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 登場人物が0人だった場合: AIで検出を試す */}
        {!isDetecting && chatFileName && detectedParticipants.length === 0 && (
          <div className="bg-white rounded-[33px] p-6 shadow-md">
            <div className="flex items-center gap-2 mb-3">
              <Users size={18} className="text-[var(--blue-500)]" />
              <p className="text-sm font-bold text-gray-700">登場人物が検出されませんでした</p>
            </div>
            <p className="text-xs text-gray-600 mb-4">
              このテキストの形式では自動検出できませんでした。AIで登場人物を推定してみましょう。
            </p>
            {extractionError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                <Info size={16} className="text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800 flex-1">{extractionError}</p>
                {setExtractionError && (
                  <button type="button" onClick={() => setExtractionError(null)} className="shrink-0 text-amber-600 hover:underline" aria-label="閉じる">×</button>
                )}
              </div>
            )}
            <button
              type="button"
              disabled={isExtractingParticipants}
              onClick={onExtractWithAI}
              className="w-full h-12 rounded-full font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 bg-[var(--blue-500)] hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isExtractingParticipants ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>AIで登場人物を検出中...</span>
                </>
              ) : (
                <>
                  <MessageCircle size={18} />
                  <span>AIで登場人物を検出</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="fixed bottom-6 left-0 right-0 px-6 max-w-lg mx-auto">
        <button 
          disabled={!canGoNextTorisetsu}
          onClick={() => startTorisetsuAnalysis(chatTextData, detectedParticipants)}
          className={`w-full h-[60px] rounded-full font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 ${
            canGoNextTorisetsu
              ? 'bg-[var(--blue-500)] hover:opacity-90 cursor-pointer' 
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {canGoNextTorisetsu ? (
            <>
              <span>次へ進む</span>
              <ChevronLeft size={20} className="rotate-180 shrink-0" />
            </>
          ) : (
            <span className="text-sm">チャットデータをアップロードしてください</span>
          )}
        </button>
      </div>
    </div>
  );
};

// ③ 好みアーカイブ専用: チャットデータ入力画面（1ファイル・登場人物自動検出）
const ArchiveInputScreen = ({
  chatFileName,
  setChatFileName,
  chatTextData,
  setChatTextData,
  detectedParticipants,
  setDetectedParticipants,
  isDetecting,
  setIsDetecting,
  detectionProgress,
  setDetectionProgress,
  onStartArchive,
  canGoNextArchive,
  onExtractWithAI,
  isExtractingParticipants,
  extractionError,
  setExtractionError,
}) => {
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setChatFileName(file.name);
      setIsDetecting(true);
      setDetectionProgress(0);
      if (setExtractionError) setExtractionError(null);

      const reader = new FileReader();
      reader.onload = async (event) => {
        const textData = event.target.result;
        setChatTextData(textData);

        const progressInterval = setInterval(() => {
          setDetectionProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }, 50);

        setTimeout(() => {
          const participants = detectParticipants(textData);
          setDetectedParticipants(participants);
          clearInterval(progressInterval);
          setDetectionProgress(100);
          setTimeout(() => setIsDetecting(false), 300);
        }, 800);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto pb-28">
      <h2 className="text-xl font-bold text-gray-700 mb-2 text-center">チャットデータを投入しよう！</h2>
      <div className="flex justify-center mb-6">
        <img src="/kumogura-shippo.gif" alt="" className="max-w-full max-h-[320px] w-full object-contain rounded-xl" />
      </div>
      <p className="text-center text-gray-500 text-sm mb-8">
        趣味の話をしている友人や家族との<br />
        LINEトーク（txt）をアップロードしてね！<br />
        登場人物を自動で検出するよ！
      </p>

      <div className="space-y-5">
        <div className="rounded-[33px] overflow-hidden shadow-md flex flex-col transition-all focus-within:ring-2 focus-within:ring-[#3986BB]/30 relative">
          <div className={`absolute inset-0 bg-white rounded-[33px] transition-opacity duration-300 ${chatFileName ? 'opacity-100' : 'opacity-20'}`} />
          <div className="relative p-[28px] flex flex-col gap-4">
            <p className="text-sm font-bold text-gray-700">チャットデータ</p>
            <div className="flex items-center gap-3 min-h-[44px]">
              <label className="cursor-pointer shrink-0 h-[30px] flex items-center justify-center hover:opacity-90 transition-opacity">
                <img
                  src={chatFileName ? '/button_detachange.svg' : '/action_upload_file1.svg'}
                  alt={chatFileName ? 'データを変更' : 'データを追加'}
                  className="h-[30px] w-auto"
                />
                <input type="file" accept=".txt" className="hidden" onChange={handleFileChange} />
              </label>
              <div className={`flex-1 min-h-[30px] px-[28px] rounded-[15px] flex items-center justify-center gap-2`}>
                <FileText size={16} className={chatFileName ? 'text-[#2A5E83]' : 'text-gray-400'} />
                <span className={`text-sm truncate ${chatFileName ? 'text-[#2A5E83] font-medium' : 'text-gray-500'}`}>
                  {chatFileName || '追加されていません'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {isDetecting && (
          <div className="bg-white/90 rounded-[33px] p-6 shadow-md">
            <p className="text-sm font-bold text-gray-700 mb-3 text-center flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-[var(--blue-500)]" />
              登場人物を検出中...
            </p>
            <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden shadow-inner">
              <div className="bg-[var(--blue-500)] h-full transition-all duration-300 ease-out rounded-full" style={{ width: `${detectionProgress}%` }} />
            </div>
            <p className="text-right mt-1 text-xs text-[var(--blue-500)] font-mono">{detectionProgress}%</p>
          </div>
        )}

        {!isDetecting && detectedParticipants.length > 0 && (
          <div className="bg-white rounded-[33px] p-6 shadow-md">
            <div className="flex items-center gap-2 mb-4">
              <Users size={18} className="text-[var(--blue-500)]" />
              <p className="text-sm font-bold text-gray-700">検出された登場人物（{detectedParticipants.length}名）</p>
            </div>
            <div className="space-y-2">
              {detectedParticipants.map((name, index) => (
                <div key={index} className="bg-[#D4EDFF] rounded-full px-4 py-2 text-sm font-semibold text-[#2A5E83] flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[var(--blue-500)] text-white text-xs flex items-center justify-center shrink-0">{index + 1}</span>
                    <span className="truncate">{name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetectedParticipants(detectedParticipants.filter((_, i) => i !== index))}
                    className="shrink-0 w-7 h-7 rounded-full border-2 border-[#3986BB] flex items-center justify-center text-[#3986BB] hover:bg-[#3986BB] hover:text-white transition-colors text-base leading-none"
                    aria-label={`${name}を削除`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isDetecting && chatFileName && detectedParticipants.length === 0 && (
          <div className="bg-white rounded-[33px] p-6 shadow-md">
            <div className="flex items-center gap-2 mb-3">
              <Users size={18} className="text-[var(--blue-500)]" />
              <p className="text-sm font-bold text-gray-700">登場人物が検出されませんでした</p>
            </div>
            <p className="text-xs text-gray-600 mb-4">このテキストの形式では自動検出できませんでした。AIで登場人物を推定してみましょう。</p>
            {extractionError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                <Info size={16} className="text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800 flex-1">{extractionError}</p>
                {setExtractionError && (
                  <button type="button" onClick={() => setExtractionError(null)} className="shrink-0 text-amber-600 hover:underline" aria-label="閉じる">×</button>
                )}
              </div>
            )}
            <button
              type="button"
              disabled={isExtractingParticipants}
              onClick={onExtractWithAI}
              className="w-full h-12 rounded-full font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 bg-[var(--blue-500)] hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isExtractingParticipants ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>AIで登場人物を検出中...</span>
                </>
              ) : (
                <>
                  <MessageCircle size={18} />
                  <span>AIで登場人物を検出</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="fixed bottom-6 left-0 right-0 px-6 max-w-lg mx-auto">
        <button
          disabled={!canGoNextArchive}
          onClick={onStartArchive}
          className={`w-full h-[60px] rounded-full font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 ${
            canGoNextArchive ? 'bg-[var(--blue-500)] hover:opacity-90 cursor-pointer' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {canGoNextArchive ? (
            <>
              <span>次へ進む</span>
              <ChevronLeft size={20} className="rotate-180 shrink-0" />
            </>
          ) : (
            <span className="text-sm">チャットデータをアップロードしてください</span>
          )}
        </button>
      </div>
    </div>
  );
};

// 好みアーカイブ分析中にくもぐらが話すセリフ（3秒表示・3秒非表示で順に表示）
const KUMOGURA_ARCHIVE_ANALYZING_LINES = [
  '趣味の移り変わり、分析してるよ',
  'どんな時代があったかな？',
  'おもしろいこと見つけたかも',
  'もう少し待ってね',
  '歴史年表、できてきたよ',
  '君の好みの変化、わかったよ',
];

// ④ 好みアーカイブ専用: 分析中画面（プログレスバー＋くもぐらしっぽGIF＋セリフ）
const ArchiveAnalyzingScreen = ({ analysisStatus, analysisProgress }) => {
  const [speechVisible, setSpeechVisible] = useState(true);
  const [speechIndex, setSpeechIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setSpeechVisible((v) => {
        if (!v) setSpeechIndex((i) => (i + 1) % KUMOGURA_ARCHIVE_ANALYZING_LINES.length);
        return !v;
      });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const currentLine = KUMOGURA_ARCHIVE_ANALYZING_LINES[speechIndex];

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-transparent">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img src="/cloud.png" alt="" className="absolute cloud-flow w-32 opacity-40 top-[15%] mix-blend-screen" />
        <img src="/cloud.png" alt="" className="absolute cloud-flow-2 w-24 opacity-30 top-[35%] mix-blend-screen" />
        <img src="/cloud.png" alt="" className="absolute cloud-flow-3 w-28 opacity-35 top-[55%] mix-blend-screen" />
        <img src="/cloud.png" alt="" className="absolute cloud-flow w-20 opacity-25 top-[70%] mix-blend-screen" style={{ animationDelay: '-45s' }} />
        <img src="/cloud.png" alt="" className="absolute cloud-flow-2 w-36 opacity-30 top-[25%] mix-blend-screen" style={{ animationDelay: '-15s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4 flex flex-col items-center gap-4 h-[90vh] py-6">
        <div className="w-full max-w-md shrink-0">
          <p className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
            {analysisProgress < 100 && <Loader2 size={16} className="animate-spin text-[var(--blue-500)]" />}
            {analysisStatus}
          </p>
          <div className="w-full bg-white/80 h-2.5 rounded-full overflow-hidden shadow-inner">
            <div
              className="bg-[var(--blue-500)] h-full transition-all duration-300 ease-out rounded-full"
              style={{ width: `${analysisProgress}%` }}
            />
          </div>
          <p className="text-right mt-1 text-xs text-[var(--blue-500)] font-mono">{analysisProgress}%</p>
        </div>

        <div className="w-full flex-1 min-h-0 flex flex-col items-center justify-center bg-[var(--blue-50)]/80 rounded-[28px] overflow-visible relative">
          <img
            src="/kumogura-shippo.gif"
            alt=""
            className="max-w-full max-h-[min(70vh,480px)] w-full object-contain relative z-0"
          />
          <div
            className="absolute bottom-0 left-0 right-0 flex justify-center z-10 pb-1"
            style={{
              opacity: speechVisible ? 1 : 0,
              transition: 'opacity 800ms ease',
            }}
          >
            <div className="relative max-w-[90%]">
              <div className="bg-white/95 rounded-[28px] px-5 py-3 shadow-lg border border-[var(--blue-500)]/20">
                <p className="text-sm font-bold text-[var(--black-dark)] text-center">{currentLine}</p>
              </div>
              <div
                className="absolute left-1/2 -translate-x-1/2 w-0 h-0 border-b-[10px] border-b-white/95 border-x-[10px] border-x-transparent"
                style={{
                  bottom: '100%',
                  transform: 'translate(-50%, 6px)',
                  filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.05))',
                }}
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ⑤ 好みアーカイブ専用: 分析結果画面（共通の趣味嗜好・期間・30字以内の説明を1ページで表示）
const ArchiveResultsScreen = ({ resultsData, apiError }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-transparent">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img src="/cloud.png" alt="" className="absolute cloud-flow w-32 opacity-40 top-[15%] mix-blend-screen" />
        <img src="/cloud.png" alt="" className="absolute cloud-flow-2 w-24 opacity-30 top-[35%] mix-blend-screen" />
        <img src="/cloud.png" alt="" className="absolute cloud-flow-3 w-28 opacity-35 top-[55%] mix-blend-screen" />
        <img src="/cloud.png" alt="" className="absolute cloud-flow w-20 opacity-25 top-[70%] mix-blend-screen" style={{ animationDelay: '-45s' }} />
        <img src="/cloud.png" alt="" className="absolute cloud-flow-2 w-36 opacity-30 top-[25%] mix-blend-screen" style={{ animationDelay: '-15s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4 flex flex-col h-[90vh] py-4">
        <div className="w-full flex-1 min-h-0 flex flex-col bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden">
          <div className="shrink-0 p-5 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={22} className="text-[var(--blue-500)] shrink-0" />
              <h2 className="text-lg font-bold text-gray-800">趣味嗜好の歴史年表</h2>
            </div>
            {apiError && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                <Info size={16} className="text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800">{apiError}（例の結果を表示しています）</p>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
            {resultsData.map((item, index) => (
              <section key={index} className="bg-white rounded-[28px] shadow-lg overflow-hidden p-4">
                <h4 className="font-bold text-[var(--black-dark)] text-sm mb-1 flex items-center gap-2">
                  <span className="text-base" aria-hidden>{item.emoji || '✨'}</span>
                  <span>{item.title}</span>
                </h4>
                <p className="text-xs text-[var(--black-mid)] mb-2">{item.period}</p>
                <p className="text-xs text-[var(--black-mid)] leading-relaxed">{item.desc}</p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// トリセツ分析中にくもぐらが話すセリフ（3秒表示・3秒非表示で順に表示）
const KUMOGURA_ANALYZING_LINES = [
  'いまぼくが分析してるよ',
  'どんな結果になるかな？',
  '君のいいところ、わかったよ',
  'もう少し待ってね',
  'おもしろいこと見つけたかも',
  'みんなの取扱説明書、できてきたよ',
];

// ④ トリセツメーカー専用: 分析中画面（プログレスバー＋くもぐらしっぽGIF＋セリフ）
const TorisetsuAnalyzingScreen = ({ analysisStatus, analysisProgress }) => {
  const [speechVisible, setSpeechVisible] = useState(true);
  const [speechIndex, setSpeechIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setSpeechVisible((v) => {
        if (!v) setSpeechIndex((i) => (i + 1) % KUMOGURA_ANALYZING_LINES.length);
        return !v;
      });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const currentLine = KUMOGURA_ANALYZING_LINES[speechIndex];

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-transparent">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img src="/cloud.png" alt="" className="absolute cloud-flow w-32 opacity-40 top-[15%] mix-blend-screen" />
        <img src="/cloud.png" alt="" className="absolute cloud-flow-2 w-24 opacity-30 top-[35%] mix-blend-screen" />
        <img src="/cloud.png" alt="" className="absolute cloud-flow-3 w-28 opacity-35 top-[55%] mix-blend-screen" />
        <img src="/cloud.png" alt="" className="absolute cloud-flow w-20 opacity-25 top-[70%] mix-blend-screen" style={{ animationDelay: '-45s' }} />
        <img src="/cloud.png" alt="" className="absolute cloud-flow-2 w-36 opacity-30 top-[25%] mix-blend-screen" style={{ animationDelay: '-15s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4 flex flex-col items-center gap-4 h-[90vh] py-6">
        {/* プログレスバー */}
        <div className="w-full max-w-md shrink-0">
          <p className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
            {analysisProgress < 100 && <Loader2 size={16} className="animate-spin text-[var(--blue-500)]" />}
            {analysisStatus}
          </p>
          <div className="w-full bg-white/80 h-2.5 rounded-full overflow-hidden shadow-inner">
            <div
              className="bg-[var(--blue-500)] h-full transition-all duration-300 ease-out rounded-full"
              style={{ width: `${analysisProgress}%` }}
            />
          </div>
          <p className="text-right mt-1 text-xs text-[var(--blue-500)] font-mono">{analysisProgress}%</p>
        </div>

        {/* くもぐらしっぽGIF＋セリフ（GIFと重なってもOK・くもぐらに近い位置） */}
        <div className="w-full flex-1 min-h-0 flex flex-col items-center justify-center bg-[var(--blue-50)]/80 rounded-[28px] overflow-visible relative">
          <img
            src="/kumogura-shippo.gif"
            alt=""
            className="max-w-full max-h-[min(70vh,480px)] w-full object-contain relative z-0"
          />
          <div
            className="absolute bottom-0 left-0 right-0 flex justify-center z-10 pb-1"
            style={{
              opacity: speechVisible ? 1 : 0,
              transition: 'opacity 800ms ease',
            }}
          >
            {/* フキダシ：しっぽを本体に重ねてつなげる（三角だけ浮かない） */}
            <div className="relative max-w-[90%]">
              <div className="bg-white/95 rounded-[28px] px-5 py-3 shadow-lg border border-[var(--blue-500)]/20">
                <p className="text-sm font-bold text-[var(--black-dark)] text-center">{currentLine}</p>
              </div>
              <div
                className="absolute left-1/2 -translate-x-1/2 w-0 h-0 border-b-[10px] border-b-white/95 border-x-[10px] border-x-transparent"
                style={{
                  bottom: '100%',
                  transform: 'translate(-50%, 6px)',
                  filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.05))',
                }}
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ④ 共通点発見レーダー専用: 分析中画面（分析結果画面と同じデザイン・共通点なし・見出し「待ち時間のアイスブレイク」）
const AnalyzingScreen = ({ analysisStatus, analysisProgress, icebreakQ, firstRespondent }) => (
  <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-transparent">
    {/* 背景: 雲（分析結果画面と同じ） */}
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <img src="/cloud.png" alt="" className="absolute cloud-flow w-32 opacity-40 top-[15%] mix-blend-screen" />
      <img src="/cloud.png" alt="" className="absolute cloud-flow-2 w-24 opacity-30 top-[35%] mix-blend-screen" />
      <img src="/cloud.png" alt="" className="absolute cloud-flow-3 w-28 opacity-35 top-[55%] mix-blend-screen" />
      <img src="/cloud.png" alt="" className="absolute cloud-flow w-20 opacity-25 top-[70%] mix-blend-screen" style={{ animationDelay: '-45s' }} />
      <img src="/cloud.png" alt="" className="absolute cloud-flow-2 w-36 opacity-30 top-[25%] mix-blend-screen" style={{ animationDelay: '-15s' }} />
    </div>

    <div className="relative z-10 w-full max-w-md mx-4 flex flex-col items-center gap-4">
      {/* 進捗: カードの上に表示 */}
      <div className="w-full max-w-md">
        <p className="text-sm font-bold text-gray-700 mb-2 animate-pulse">{analysisStatus}</p>
        <div className="w-full bg-white/80 h-2.5 rounded-full overflow-hidden shadow-inner">
          <div
            className="bg-[var(--blue-500)] h-full transition-all duration-300 ease-out rounded-full"
            style={{ width: `${analysisProgress}%` }}
          />
        </div>
        <p className="text-right mt-1 text-xs text-[var(--blue-500)] font-mono">{analysisProgress}%</p>
      </div>

      {/* アイスブレイクカード */}
      <div className="w-full bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden">
        <div className="p-5 pb-4">
          {/* 見出し: 待ち時間のアイスブレイク */}
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle size={22} className="text-[var(--blue-500)] shrink-0" />
            <h2 className="text-lg font-bold text-gray-800">待ち時間のアイスブレイク</h2>
          </div>

          {/* 最初の回答者（分析結果画面と同じスタイル） */}
          <div className="flex justify-center my-4">
            <div className="bg-white border-2 border-[var(--blue-500)] rounded-[24px] px-6 py-3 shadow-lg inline-block">
              <p className="text-xs text-gray-500 text-center mb-0.5">最初の回答者</p>
              <p className="text-base font-bold text-gray-800 text-center">{firstRespondent} さん</p>
            </div>
          </div>

          {/* 質問カード（分析結果の Q カードと同じスタイル） */}
          <div className="bg-white rounded-2xl p-4 shadow-lg">
            <p className="text-xs text-gray-500 font-bold mb-2">お題</p>
            <p className="text-sm text-gray-800 leading-relaxed text-left">
              {icebreakQ}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ⑤ 共通点発見レーダー専用: 分析結果画面（中央配置・固定・スクロールなし・status_kyotsu_1風）
const CLOUD_SRC = '/cloud.png';

const ResultsScreen = ({ resultPage, setResultPage, respondentOrder, handleReload, resultsData, apiError }) => {
  const currentData = resultsData[resultPage - 1] || resultsData[0];
  const currentRespondent = respondentOrder[resultPage - 1] || 'あなた';

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-transparent">
      {/* 背景: 雲がゆっくり等速で流れる */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img src={CLOUD_SRC} alt="" className="absolute cloud-flow w-32 opacity-40 top-[15%] mix-blend-screen" />
        <img src={CLOUD_SRC} alt="" className="absolute cloud-flow-2 w-24 opacity-30 top-[35%] mix-blend-screen" />
        <img src={CLOUD_SRC} alt="" className="absolute cloud-flow-3 w-28 opacity-35 top-[55%] mix-blend-screen" />
        <img src={CLOUD_SRC} alt="" className="absolute cloud-flow w-20 opacity-25 top-[70%] mix-blend-screen" style={{ animationDelay: '-45s' }} />
        <img src={CLOUD_SRC} alt="" className="absolute cloud-flow-2 w-36 opacity-30 top-[25%] mix-blend-screen" style={{ animationDelay: '-15s' }} />
      </div>

      {/* カード: 縦中央・スクロールなし・コンパクト */}
      <div className="relative z-10 w-full max-w-md mx-4 flex flex-col items-center">
        <div
          key={resultPage}
          className="w-full bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden animate-in fade-in slide-in-from-right-8 duration-500"
        >
          <div className="p-5 pb-4">
            {apiError && (
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                <Info size={16} className="text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800">{apiError}（例の結果を表示しています）</p>
              </div>
            )}
            {/* 共通点ヘッダー */}
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={22} className="text-[var(--blue-500)] shrink-0" />
              <h2 className="text-lg font-bold text-gray-800">共通点 {resultPage}</h2>
            </div>
            {/* くもぐらのコメント（共通点タイトル＋説明） */}
            <div className="mb-4">
              <h3 className="font-bold text-gray-800 text-base mb-1">{currentData.title}</h3>
              <p className="text-sm text-gray-700 leading-relaxed text-left">
                {currentData.desc}
              </p>
            </div>
            {/* 最初の回答者（質問カードより先・雲形風） */}
            <div className="flex justify-center my-4">
              <div className="bg-white border-2 border-[var(--blue-500)] rounded-[24px] px-6 py-3 shadow-lg inline-block">
                <p className="text-xs text-gray-500 text-center mb-0.5">最初の回答者</p>
                <p className="text-base font-bold text-gray-800 text-center">{currentRespondent} さん</p>
              </div>
            </div>
            {/* 質問カード（status_answerer風・Q N. + 質問文） */}
            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <p className="text-xs text-gray-500 font-bold mb-2">Q {resultPage}.</p>
              <p className="text-sm text-gray-800 leading-relaxed text-left">
                {currentData.question}
              </p>
            </div>
          </div>
          {/* ページネーション */}
          <div className="p-3 bg-white/50 border-t border-[var(--blue-500-30)] flex justify-between items-center">
            <button
              disabled={resultPage === 1}
              onClick={() => setResultPage(p => p - 1)}
              className={`p-2 rounded-full transition-colors ${resultPage === 1 ? 'text-gray-300' : 'text-[var(--blue-500)] hover:bg-white/80'}`}
            >
              <ChevronLeft size={24} />
            </button>
            <div className="flex gap-2">
              {[1, 2, 3].map(num => (
                <div
                  key={num}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${resultPage === num ? 'bg-[var(--blue-500)] w-6' : 'bg-[var(--blue-500-30)]'}`}
                />
              ))}
            </div>
            <button
              disabled={resultPage === 3}
              onClick={() => setResultPage(p => p + 1)}
              className={`p-2 rounded-full rotate-180 transition-colors ${resultPage === 3 ? 'text-gray-300' : 'text-[var(--blue-500)] hover:bg-white/80'}`}
            >
              <ChevronLeft size={24} />
            </button>
          </div>
        </div>
        {resultPage === 3 && (
          <div className="mt-5 text-center w-full max-w-md">
            <button
              onClick={handleReload}
              className="group bg-[var(--blue-500)] hover:opacity-90 text-white font-bold h-14 min-h-[56px] px-8 rounded-full transition-all active:scale-95 flex items-center justify-center gap-2 mx-auto"
            >
              <RefreshCcw size={20} className="group-hover:rotate-180 transition-transform duration-500" />
              おかわり！
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ⑤ トリセツメーカー専用: 分析結果画面（一人1ページ・ツール詳細説明に基づくレイアウト）
const TorisetsuResultsScreen = ({ resultPage, setResultPage, resultsData, totalPages, apiError }) => {
  const currentPerson = resultsData[resultPage - 1] || resultsData[0];
  if (!currentPerson) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-transparent">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img src="/cloud.png" alt="" className="absolute cloud-flow w-32 opacity-40 top-[15%] mix-blend-screen" />
        <img src="/cloud.png" alt="" className="absolute cloud-flow-2 w-24 opacity-30 top-[35%] mix-blend-screen" />
        <img src="/cloud.png" alt="" className="absolute cloud-flow-3 w-28 opacity-35 top-[55%] mix-blend-screen" />
        <img src="/cloud.png" alt="" className="absolute cloud-flow w-20 opacity-25 top-[70%] mix-blend-screen" style={{ animationDelay: '-45s' }} />
        <img src="/cloud.png" alt="" className="absolute cloud-flow-2 w-36 opacity-30 top-[25%] mix-blend-screen" style={{ animationDelay: '-15s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4 flex flex-col items-center h-[90vh] py-4">
        <div
          key={resultPage}
          className="w-full flex-1 min-h-0 flex flex-col bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden animate-in fade-in slide-in-from-right-8 duration-500"
        >
          {/* ヘッダー: 〇〇の取り扱い説明書 */}
          <div className="shrink-0 p-5 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={22} className="text-[var(--blue-500)] shrink-0" />
              <h2 className="text-lg font-bold text-gray-800">{currentPerson.name}の取り扱い説明書</h2>
            </div>
            {apiError && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                <Info size={16} className="text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800">{apiError}（例の結果を表示しています）</p>
              </div>
            )}
          </div>

          {/* 本文（スクロール可能） */}
          <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
            <section>
              <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
                <span className="text-lg">{currentPerson.strengths.emoji || '📝'}</span>
                得意なこと
              </h4>
              <div className="bg-white rounded-[28px] shadow-lg overflow-hidden p-4">
                <h4 className="font-bold text-[var(--black-dark)] text-sm mb-0.5">
                  {currentPerson.strengths.emoji ? `${currentPerson.strengths.emoji} ` : ''}{currentPerson.strengths.title}
                </h4>
                <p className="text-xs text-[var(--black-mid)] leading-relaxed">{currentPerson.strengths.desc}</p>
              </div>
            </section>
            <section>
              <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
                <span className="text-lg">{currentPerson.weaknesses.emoji || '🌀'}</span>
                苦手なこと
              </h4>
              <div className="bg-white rounded-[28px] shadow-lg overflow-hidden p-4">
                <h4 className="font-bold text-[var(--black-dark)] text-sm mb-0.5">
                  {currentPerson.weaknesses.emoji ? `${currentPerson.weaknesses.emoji} ` : ''}{currentPerson.weaknesses.title}
                </h4>
                <p className="text-xs text-[var(--black-mid)] leading-relaxed">{currentPerson.weaknesses.desc}</p>
              </div>
            </section>
            <section>
              <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
                <span className="text-lg">{currentPerson.praise.emoji || '🌟'}</span>
                嬉しい頼まれごと・褒められ方
              </h4>
              <div className="bg-white rounded-[28px] shadow-lg overflow-hidden p-4">
                <h4 className="font-bold text-[var(--black-dark)] text-sm mb-0.5">
                  {currentPerson.praise.emoji ? `${currentPerson.praise.emoji} ` : ''}{currentPerson.praise.title}
                </h4>
                <p className="text-xs text-[var(--black-mid)] leading-relaxed">{currentPerson.praise.desc}</p>
              </div>
            </section>
            <section>
              <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
                <span className="text-lg">{currentPerson.feedback.emoji || '🎯'}</span>
                好ましいフィードバックの仕方
              </h4>
              <div className="bg-white rounded-[28px] shadow-lg overflow-hidden p-4">
                <h4 className="font-bold text-[var(--black-dark)] text-sm mb-0.5">
                  {currentPerson.feedback.emoji ? `${currentPerson.feedback.emoji} ` : ''}{currentPerson.feedback.title}
                </h4>
                <p className="text-xs text-[var(--black-mid)] leading-relaxed">{currentPerson.feedback.desc}</p>
              </div>
            </section>
          </div>

          {/* ページネーション */}
          <div className="shrink-0 p-3 bg-white/50 border-t border-[var(--blue-500-30)] flex justify-between items-center">
            <button
              disabled={resultPage === 1}
              onClick={() => setResultPage(p => p - 1)}
              className={`p-2 rounded-full transition-colors ${resultPage === 1 ? 'text-gray-300' : 'text-[var(--blue-500)] hover:bg-white/80'}`}
            >
              <ChevronLeft size={24} />
            </button>
            <div className="flex gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                <div
                  key={num}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${resultPage === num ? 'bg-[var(--blue-500)] w-6' : 'bg-[var(--blue-500-30)]'}`}
                />
              ))}
            </div>
            <button
              disabled={resultPage === totalPages}
              onClick={() => setResultPage(p => p + 1)}
              className={`p-2 rounded-full rotate-180 transition-colors ${resultPage === totalPages ? 'text-gray-300' : 'text-[var(--blue-500)] hover:bg-white/80'}`}
            >
              <ChevronLeft size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [screen, setScreen] = useState('intro'); 
  const [selectedTool, setSelectedTool] = useState(null);
  
  // 共通点発見レーダー用の状態
  const [participants, setParticipants] = useState([
    { id: 1, name: '', fileName: '', textData: '', placeholder: 'やまだはなこ' },
    { id: 2, name: '', fileName: '', textData: '', placeholder: 'さとうけんた' },
  ]);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('データ読み込み中...');
  const [resultPage, setResultPage] = useState(1);
  const [icebreakQ, setIcebreakQ] = useState('');
  const [firstRespondent, setFirstRespondent] = useState('');
  const [respondentOrder, setRespondentOrder] = useState([]);
  const [resultsData, setResultsData] = useState(DEFAULT_RESULTS);
  const [finderApiError, setFinderApiError] = useState(null); // 共通点発見レーダーAI失敗時
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showRuleHint, setShowRuleHint] = useState(false);
  const [ruleHintFading, setRuleHintFading] = useState(false);
  
  // トリセツメーカー用の状態
  const [chatFileName, setChatFileName] = useState('');
  const [chatTextData, setChatTextData] = useState('');
  const [detectedParticipants, setDetectedParticipants] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionProgress, setDetectionProgress] = useState(0);
  const [torisetsuAnalysisProgress, setTorisetsuAnalysisProgress] = useState(0);
  const [torisetsuAnalysisStatus, setTorisetsuAnalysisStatus] = useState('データ読み込み中...');
  const [torisetsuResultPage, setTorisetsuResultPage] = useState(1);
  const [torisetsuResultsData, setTorisetsuResultsData] = useState([]);
  const [torisetsuApiError, setTorisetsuApiError] = useState(null); // AI分析失敗時
  const [isExtractingParticipants, setIsExtractingParticipants] = useState(false); // AIで登場人物抽出中
  const [extractionError, setExtractionError] = useState(null); // 登場人物抽出エラー

  // 好みアーカイブ用の状態
  const [archiveChatFileName, setArchiveChatFileName] = useState('');
  const [archiveChatTextData, setArchiveChatTextData] = useState('');
  const [archiveDetectedParticipants, setArchiveDetectedParticipants] = useState([]);
  const [archiveIsDetecting, setArchiveIsDetecting] = useState(false);
  const [archiveDetectionProgress, setArchiveDetectionProgress] = useState(0);
  const [archiveExtractionError, setArchiveExtractionError] = useState(null);
  const [archiveIsExtractingParticipants, setArchiveIsExtractingParticipants] = useState(false);
  const [archiveAnalysisProgress, setArchiveAnalysisProgress] = useState(0);
  const [archiveAnalysisStatus, setArchiveAnalysisStatus] = useState('データ読み込み中...');
  const [archiveResultsData, setArchiveResultsData] = useState(DEFAULT_ARCHIVE_RESULTS);
  const [archiveApiError, setArchiveApiError] = useState(null);

  // 分析結果表示直後に吹き出し表示 → 2秒でじわじわ消えて4秒で非表示
  useEffect(() => {
    if (screen !== 'results') {
      setShowRuleHint(false);
      setRuleHintFading(false);
      return;
    }
    setShowRuleHint(true);
    setRuleHintFading(false);
    const t1 = setTimeout(() => setRuleHintFading(true), 2000);
    const t2 = setTimeout(() => setShowRuleHint(false), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [screen]);

  const bgStyle = {
    background: 'linear-gradient(180deg, #AAD5F3 0%, #DAF7F8 63%, #D8EFF2 87%, #E5EEC8 100%)',
    minHeight: '100vh',
    fontFamily: '"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
  };

  const goBack = () => {
    if (screen === 'details') setScreen('selection');
    else if (screen === 'input') setScreen('details');
    else if (screen === 'analyzing') setScreen('input');
    else if (screen === 'results') setScreen('input');
    else if (screen === 'torisetsuResults') setScreen('input');
    else if (screen === 'archiveResults' || screen === 'archiveAnalyzing') setScreen('input');
  };

  const startAnalysis = async () => {
    setScreen('analyzing');
    setAnalysisProgress(0);
    setAnalysisStatus('データ読み込み中...');
    setResultsData(DEFAULT_RESULTS);
    setFinderApiError(null);
    
    const activeParticipants = participants.filter(p => p.name.trim() !== '' && p.textData);
    const names = activeParticipants.length > 0 ? activeParticipants.map(p => p.name) : ['あなた'];
    
    const shuffleArray = (array) => {
      const newArray = [...array];
      for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
      }
      return newArray;
    };

    let shuffledNames = shuffleArray(names);
    const icebreakRespondent = shuffledNames[0];
    setIcebreakQ(ICEBREAK_QUESTIONS[Math.floor(Math.random() * ICEBREAK_QUESTIONS.length)]);
    setFirstRespondent(icebreakRespondent);

    let resultOrder = [...shuffledNames];
    while (resultOrder.length < 3) {
      const additional = shuffleArray(names);
      if (additional[0] === resultOrder[resultOrder.length - 1] && names.length > 1) {
         additional.push(additional.shift());
      }
      resultOrder = resultOrder.concat(additional);
    }
    setRespondentOrder(resultOrder.slice(0, 3));

    const uiInterval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 90) return 90;
        return prev + 1;
      });
    }, 50);

    try {
      setAnalysisStatus('AIが会話を分析中...');
      const aiResults = await analyzeWithGemini(activeParticipants);
      setResultsData(aiResults);
      setFinderApiError(null);
    } catch (e) {
      console.error(e);
      setFinderApiError(e?.message || 'AI分析に失敗しました');
      setResultsData(DEFAULT_RESULTS);
    } finally {
      clearInterval(uiInterval);
      setAnalysisProgress(100);
      setAnalysisStatus('分析完了！');
      setTimeout(() => setScreen('results'), 500);
    }
  };

  const handleReload = () => {
    setResultPage(1);
    startAnalysis();
  };

  const startTorisetsuAnalysis = async (textData, participants) => {
    const chatText = textData ?? chatTextData;
    const names = participants ?? detectedParticipants;
    if (!chatText?.trim() || !names?.length) {
      console.error('startTorisetsuAnalysis: データ不足', { hasText: !!chatText?.trim(), namesCount: names?.length });
      return;
    }

    // 1. 分析中画面へ遷移・分析開始
    setScreen('analyzing');
    setTorisetsuAnalysisProgress(0);
    setTorisetsuAnalysisStatus('分析を開始...');
    setTorisetsuApiError(null); // 前回のエラーをクリア

    const uiInterval = setInterval(() => {
      setTorisetsuAnalysisProgress((prev) => {
        if (prev >= 90) return 90;
        return prev + 2;
      });
    }, 50);

    setTorisetsuAnalysisStatus('AIが会話を分析中...');

    // 2. AI分析実行
    try {
      const results = await analyzeTorisetsuWithGemini(chatText, names);
      setTorisetsuResultsData(results);
      setTorisetsuApiError(null);
    } catch (e) {
      console.error('トリセツ分析エラー:', e);
      setTorisetsuApiError(e?.message || 'AI分析に失敗しました');
      const fallback = names.map(name => ({
        name,
        ...DEFAULT_TORISETSU_ITEM,
      }));
      setTorisetsuResultsData(fallback);
    }

    // 3. 終わったらプログレスバーを満たす
    clearInterval(uiInterval);
    setTorisetsuAnalysisProgress(100);
    setTorisetsuAnalysisStatus('分析完了！');
    setTorisetsuResultPage(1);

    // 4. プログレスバーが満ちたのを見せてから画面を変える
    setTimeout(() => setScreen('torisetsuResults'), 1000);
  };

  const validCount = participants.filter(p => p.name && p.fileName).length;
  const canGoNext = validCount >= 2;
  
  const canGoNextTorisetsu = chatFileName && detectedParticipants.length >= 1 && !isDetecting && !isExtractingParticipants;

  // トリセツ: テキストからAIで登場人物を抽出（検出0人時用）
  const handleExtractParticipantsWithAI = async () => {
    if (!chatTextData?.trim()) return;
    setIsExtractingParticipants(true);
    setExtractionError(null);
    try {
      const names = await extractParticipantsWithGemini(chatTextData);
      setDetectedParticipants(names);
      if (names.length === 0) setExtractionError('登場人物を検出できませんでした。別の形式のテキストをお試しください。');
    } catch (e) {
      console.error(e);
      setExtractionError(e?.message || 'AIでの検出に失敗しました');
    } finally {
      setIsExtractingParticipants(false);
    }
  };

  const isFinderFlow = selectedTool?.id === 'finder';
  const isTorisetsuFlow = selectedTool?.id === 'torisetsu';
  const isArchiveFlow = selectedTool?.id === 'archive';

  const canGoNextArchive = archiveChatFileName && archiveDetectedParticipants.length >= 1 && !archiveIsDetecting && !archiveIsExtractingParticipants;

  const handleArchiveExtractWithAI = async () => {
    if (!archiveChatTextData?.trim()) return;
    setArchiveIsExtractingParticipants(true);
    setArchiveExtractionError(null);
    try {
      const names = await extractParticipantsWithGemini(archiveChatTextData);
      setArchiveDetectedParticipants(names);
      if (names.length === 0) setArchiveExtractionError('登場人物を検出できませんでした。別の形式のテキストをお試しください。');
    } catch (e) {
      console.error(e);
      setArchiveExtractionError(e?.message || 'AIでの検出に失敗しました');
    } finally {
      setArchiveIsExtractingParticipants(false);
    }
  };

  const startArchiveAnalysis = async () => {
    const chatText = archiveChatTextData;
    const names = archiveDetectedParticipants;
    if (!chatText?.trim() || !names?.length) {
      console.error('startArchiveAnalysis: データ不足');
      return;
    }

    setScreen('archiveAnalyzing');
    setArchiveAnalysisProgress(0);
    setArchiveAnalysisStatus('分析を開始...');
    setArchiveApiError(null);

    const uiInterval = setInterval(() => {
      setArchiveAnalysisProgress((prev) => {
        if (prev >= 90) return 90;
        return prev + 2;
      });
    }, 50);

    setArchiveAnalysisStatus('AIが趣味の移り変わりを分析中...');

    try {
      const results = await analyzeArchiveWithGemini(chatText, names);
      setArchiveResultsData(results);
      setArchiveApiError(null);
    } catch (e) {
      console.error('好みアーカイブ分析エラー:', e);
      setArchiveApiError(e?.message || 'AI分析に失敗しました');
      setArchiveResultsData(DEFAULT_ARCHIVE_RESULTS);
    }

    clearInterval(uiInterval);
    setArchiveAnalysisProgress(100);
    setArchiveAnalysisStatus('分析完了！');
    setTimeout(() => setScreen('archiveResults'), 1000);
  };

  return (
    <div style={bgStyle} className="text-gray-900 overflow-x-hidden selection:bg-blue-200 selection:text-blue-900">
      <main className="container mx-auto max-w-lg min-h-screen relative">
        {screen === 'intro' && <IntroScreen setScreen={setScreen} />}
        {screen === 'selection' && <SelectionScreen setSelectedTool={setSelectedTool} setScreen={setScreen} />}
        {screen === 'details' && <DetailsScreen selectedTool={selectedTool} setScreen={setScreen} />}
        
        {/* 共通点発見レーダーのフロー */}
        {screen === 'input' && isFinderFlow && <InputScreen participants={participants} setParticipants={setParticipants} startAnalysis={startAnalysis} canGoNext={canGoNext} />}
        {screen === 'analyzing' && isFinderFlow && <AnalyzingScreen analysisStatus={analysisStatus} analysisProgress={analysisProgress} icebreakQ={icebreakQ} firstRespondent={firstRespondent} />}
        {screen === 'analyzing' && isTorisetsuFlow && <TorisetsuAnalyzingScreen analysisStatus={torisetsuAnalysisStatus} analysisProgress={torisetsuAnalysisProgress} />}
        {screen === 'torisetsuResults' && isTorisetsuFlow && <TorisetsuResultsScreen resultPage={torisetsuResultPage} setResultPage={setTorisetsuResultPage} resultsData={torisetsuResultsData} totalPages={torisetsuResultsData.length} apiError={torisetsuApiError} />}
        {screen === 'results' && isFinderFlow && <ResultsScreen resultPage={resultPage} setResultPage={setResultPage} respondentOrder={respondentOrder} handleReload={handleReload} resultsData={resultsData} apiError={finderApiError} />}
        
        {/* トリセツメーカーのフロー */}
        {screen === 'input' && isTorisetsuFlow && <TorisetsuInputScreen 
          chatFileName={chatFileName}
          setChatFileName={setChatFileName}
          chatTextData={chatTextData}
          setChatTextData={setChatTextData}
          detectedParticipants={detectedParticipants}
          setDetectedParticipants={setDetectedParticipants}
          isDetecting={isDetecting}
          setIsDetecting={setIsDetecting}
          detectionProgress={detectionProgress}
          setDetectionProgress={setDetectionProgress}
          startTorisetsuAnalysis={startTorisetsuAnalysis}
          canGoNextTorisetsu={canGoNextTorisetsu}
          onExtractWithAI={handleExtractParticipantsWithAI}
          isExtractingParticipants={isExtractingParticipants}
          extractionError={extractionError}
          setExtractionError={setExtractionError}
        />}

        {/* 好みアーカイブのフロー */}
        {screen === 'input' && isArchiveFlow && (
          <ArchiveInputScreen
            chatFileName={archiveChatFileName}
            setChatFileName={setArchiveChatFileName}
            chatTextData={archiveChatTextData}
            setChatTextData={setArchiveChatTextData}
            detectedParticipants={archiveDetectedParticipants}
            setDetectedParticipants={setArchiveDetectedParticipants}
            isDetecting={archiveIsDetecting}
            setIsDetecting={setArchiveIsDetecting}
            detectionProgress={archiveDetectionProgress}
            setDetectionProgress={setArchiveDetectionProgress}
            onStartArchive={startArchiveAnalysis}
            canGoNextArchive={canGoNextArchive}
            onExtractWithAI={handleArchiveExtractWithAI}
            isExtractingParticipants={archiveIsExtractingParticipants}
            extractionError={archiveExtractionError}
            setExtractionError={setArchiveExtractionError}
          />
        )}
        {screen === 'archiveAnalyzing' && isArchiveFlow && (
          <ArchiveAnalyzingScreen analysisStatus={archiveAnalysisStatus} analysisProgress={archiveAnalysisProgress} />
        )}
        {screen === 'archiveResults' && isArchiveFlow && (
          <ArchiveResultsScreen resultsData={archiveResultsData} apiError={archiveApiError} />
        )}
      </main>
      <BackButton screen={screen} goBack={goBack} />
      <RuleButton screen={screen} onOpenRule={() => setShowRuleModal(true)} />
      {screen === 'results' && showRuleHint && (
        <div className={`fixed bottom-24 right-6 z-50 max-w-[240px] transition-opacity duration-[2000ms] ease-out ${ruleHintFading ? 'opacity-0' : 'opacity-100'}`}>
          <div className="bg-white rounded-2xl px-4 py-3 shadow-xl border border-gray-200/80">
            <p className="text-sm text-gray-800 leading-relaxed">
              ぼくからルールを<br />確認できるよ！
            </p>
            <div className="absolute -bottom-2 right-8 w-4 h-4 bg-white border-r border-b border-gray-200/80 rounded-br transform rotate-45" />
          </div>
        </div>
      )}
      {showRuleModal && (
        <RuleModal
          selectedTool={selectedTool}
          onClose={() => setShowRuleModal(false)}
          onGoHome={() => {
            setShowRuleModal(false);
            setScreen('selection');
          }}
        />
      )}
    </div>
  );
};

export default App;
