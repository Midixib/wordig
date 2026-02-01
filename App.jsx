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
  { id: 'finder', name: '共通点発見レーダー', type: '複数人プレイ', tag: '初対面ならコレ!', icon: `${import.meta.env.BASE_URL}icon-finder.png`, desc: '共通点だけを丁寧に拾い上げ、"共通の温度感"を調査。' },
  { id: 'torisetsu', name: '私のトリセツメーカー', type: '一人プレイ', tag: '知り合いとやろう', icon: `${import.meta.env.BASE_URL}icon-torisetsu.png`, desc: 'メンバーの強み・苦手・喜ぶ声かけをまとめます。' },
  { id: 'archive', name: '好みアーカイブ', type: '一人プレイ', tag: '友達とやろう', icon: `${import.meta.env.BASE_URL}icon-archive.png`, desc: '時期別の好みやブームの履歴を振り返ります。' },
  { id: 'timeline', name: '関係性タイムライン', type: '一人プレイ', tag: '親友とやろう', icon: `${import.meta.env.BASE_URL}icon-timeline.png`, desc: 'トーク相手との関係に起きた変化や転換点を年別に整理する。' },
  { id: 'future', name: '５年後の未来レポート', type: '一人プレイ', tag: '友達とやろう', icon: `${import.meta.env.BASE_URL}icon-future.png`, desc: '成長傾向を分析し、5年後にどう進化するかを予測します。' },
];

// 好みアーカイブ: 分析結果のデフォルト（API失敗時・4件表示）
const DEFAULT_ARCHIVE_RESULTS = [
  { title: 'くまのぬいぐるみ', emoji: '🧸', period: '2024/08/15', desc: '「この子かわいいよね、ずっと隣に置いてる」' },
  { title: '推しのライブ', emoji: '⭐', period: '2024/11/20', desc: '「来月のライブ絶対行きたい！チケット取れた」' },
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
      questionは「この共通点（title）を参加者同士で話し合うときの、最初に投げかける質問」にしてください。
      - その共通点と直接結びついており、答えると自然にその共通点の話題に入れるものにする
      - 「好きな〇〇は？」「最近ハマっている〇〇は？」のように、共通点のテーマに沿った一言で答えられる形式
      - 難しく考えなくても答えられるカジュアルな内容。具体的なエピソードを求めず、好みや最近のことを聞く
      
      出力は以下のJSON形式のみで行ってください。Markdown記法は不要です。
      
      [
        {
          "title": "短いキャッチーなタイトル（例：『隠れ美食家』）",
          "desc": "その共通点に関する詳細な分析と、なぜそれが素晴らしいかという説明（100文字程度）",
          "question": "この共通点について話すときのお題（共通点のテーマに直結した、答えやすい質問）"
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

// 関係性タイムライン: デフォルト結果（API失敗時用）
const DEFAULT_TIMELINE_RESULTS = {
  years: [2023, 2024, 2025],
  intimacyScores: [35, 65, 90],
  yearlyData: [
    { year: 2023, catchphrase: '互いへの敬意が育む、穏やかな信頼の芽生え', quotes: [{ quote: '葵「はじめまして！プロジェクトの資料、確認しました。よろしくお願いします！」', reason: '敬語で礼儀正しく接しており、お互いにプロフェッショナルな距離感を保っているため。' }, { quote: '健太「ありがとうございます。丁寧なフィードバックをいただけて心強いです。」', reason: '共通の目的を持って協力し合い、徐々に信頼関係の土台を築き始めている段階であるため。' }] },
    { year: 2024, catchphrase: '共通の趣味で加速する、共鳴と笑いの躍動期', quotes: [{ quote: '葵「健太くん、昨日のキャンプの写真送るね。次は星が綺麗なところ行こう！」', reason: 'ニックネームで呼び合い、プライベートな時間を共有して楽しんでいる様子が伺えるため。' }, { quote: '健太「葵が撮ってくれた写真、どれも良すぎて壁紙にしたよ。次も楽しみ。」', reason: 'お互いの感性を認め合い、次の約束を自然に交わすほど心理的距離が近づいているため。' }] },
    { year: 2025, catchphrase: '言葉を超えて支え合う、盤石な心のパートナー', quotes: [{ quote: '健太「今の仕事、本当は不安なんだ。葵にだけは正直に言っておきたくて。」', reason: '弱みや不安を包み隠さず共有できる、精神的に非常に深い結びつきが生まれているため。' }, { quote: '葵「健太なら大丈夫。何があっても私が全力で味方するから、信じて。」', reason: '相手を無条件に肯定し、困難を共に乗り越えようとする強い絆と覚悟が感じられるため。' }] },
  ],
};

// 関係性タイムライン: チャットから年別の関係性変化・親密度・キャッチコピー・引用を分析
const GEMINI_TIMELINE_MODEL = GEMINI_MODEL;

const analyzeTimelineWithGemini = async (chatTextData, participantNames) => {
  if (!chatTextData || typeof chatTextData !== 'string' || chatTextData.trim().length === 0) {
    throw new Error('チャットデータがありません');
  }
  if (!participantNames?.length) {
    throw new Error('登場人物が検出されていません');
  }

  const textForAnalysis = chatTextData.substring(0, 30000);
  const namesList = participantNames.join('、');

  const participantCount = participantNames.length;
  const maxQuotes = Math.min(participantCount, 5); // 登場人物数分、最大5つまで

  const prompt = `あなたは優秀な人間関係分析AIです。
以下のLINEチャットのテキストデータを分析し、登場人物全員の関係性の変化を年別に整理してください。
データは2年以上の期間が含まれている必要があります。西暦（年）ごとの変化を抽出してください。

【チャットデータ】
${textForAnalysis}

【登場人物】
${namesList}
（全${participantCount}人）

【分析の指示】
1. チャットに含まれる西暦（年）を特定し、各年ごとに関係性を分析する。
2. 会話の量、言葉遣い（敬語⇔タメ口）、親しみやすさ、共通の話題、心理的距離感などから、各年の親密度を0〜100の数値で推定する。
3. 各年について、登場人物全体の関係性を象徴するキャッチコピーを1つ作成する（30字程度）。
4. 各年について、実際の会話を引用する。引用は「名前「発言内容」」の形式で、その年に実際に交わされた発言から選ぶ。
   - 登場人物が2人の場合は2文引用する。
   - 登場人物が3人以上の場合は、各人物が均等に表れるように${maxQuotes}文引用する（最大5文まで）。
   - 各年の引用では、できるだけ多くの異なる人物のセリフを含めること。
5. 各引用につき、なぜそのような関係性だと判断したかの理由を50字以内で1つずつ記述する。

【出力形式】JSONのみ。Markdownのコードブロックは不要。
{
  "years": [2023, 2024, 2025],
  "intimacyScores": [35, 65, 90],
  "yearlyData": [
    {
      "year": 2023,
      "catchphrase": "互いへの敬意が育む、穏やかな信頼の芽生え",
      "quotes": [
        { "quote": "葵「はじめまして！プロジェクトの資料、確認しました。よろしくお願いします！」", "reason": "敬語で礼儀正しく接しており、お互いにプロフェッショナルな距離感を保っているため。" },
        { "quote": "健太「ありがとうございます。丁寧なフィードバックをいただけて心強いです。」", "reason": "共通の目的を持って協力し合い、徐々に信頼関係の土台を築き始めている段階であるため。" }
      ]
    },
    ...
  ]
}

【重要】
- yearsとintimacyScoresの要素数は同じにすること。yearlyDataの要素数も同じこと。
- 最低2年分、最大5年分のデータを出力すること。
- quoteは実際のチャットから引用すること。登場人物の名前は【登場人物】のいずれかを使用すること。
- 登場人物が3人以上の場合は、各年の引用でできるだけ多くの異なる人物のセリフを含め、人物が均等に表れるようにすること。
- reasonは各引用に対して50字以内で必ず記述すること。`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TIMELINE_MODEL}:generateContent?key=${API_KEY}`;
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
      console.error('Gemini Timeline API Error:', data);
      throw new Error(errMsg || 'API Error');
    }

    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
      const blockReason = data.candidates?.[0]?.finishReason || data.candidates?.[0]?.safetyRatings;
      console.error('Gemini Timeline No text:', data);
      throw new Error(blockReason ? `応答がブロックされました: ${JSON.stringify(blockReason)}` : 'No response text');
    }

    resultText = resultText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(resultText);

    const years = Array.isArray(parsed.years) ? parsed.years : [];
    const intimacyScores = Array.isArray(parsed.intimacyScores) ? parsed.intimacyScores : [];
    const yearlyData = Array.isArray(parsed.yearlyData) ? parsed.yearlyData : [];

    if (years.length === 0 || yearlyData.length === 0) {
      throw new Error('有効な分析結果が得られませんでした');
    }

    const normalized = yearlyData.slice(0, 5).map((item) => ({
      year: Number(item.year) || new Date().getFullYear(),
      catchphrase: String(item.catchphrase || '').slice(0, 50),
      quotes: (item.quotes || []).slice(0, maxQuotes).map((q) => ({
        quote: String(q.quote || '').slice(0, 150),
        reason: String(q.reason || '').slice(0, 50),
      })).filter((q) => q.quote && q.reason),
    })).filter((item) => item.year && item.catchphrase && item.quotes.length >= 1);

    const finalYears = normalized.map((n) => n.year);
    const finalScores = normalized.map((_, i) => {
      const raw = intimacyScores[i];
      return typeof raw === 'number' ? Math.min(100, Math.max(0, raw)) : (i + 1) * 30;
    });

    return {
      years: finalYears.length > 0 ? finalYears : DEFAULT_TIMELINE_RESULTS.years,
      intimacyScores: finalScores.length > 0 ? finalScores : DEFAULT_TIMELINE_RESULTS.intimacyScores,
      yearlyData: normalized.length > 0 ? normalized : DEFAULT_TIMELINE_RESULTS.yearlyData,
    };
  } catch (error) {
    console.error('Timeline Analysis Failed:', error);
    throw error;
  }
};

// ５年後の未来レポート: 分析結果のデフォルト（API失敗時）
const DEFAULT_FUTURE_RESULTS = [
  {
    name: 'みずき',
    lightFuture: { title: 'デザイン×テクノロジーの架け橋となるクリエイター', desc: '卒業後、大手IT企業のUXデザイナーとして就職。持ち前の実行力と技術力を活かし、ユーザーに寄り添ったプロダクトを次々と生み出している。社内では「課題解決の天才」として頼られ、チームリーダーとして活躍中。' },
    realisticFuture: { title: '着実にキャリアを積むデザイナー', desc: '中小企業のデザイナーとして働きながら、自分のペースでスキルアップを続けている。仕事とプライベートのバランスを大切にし、趣味のプロジェクトにも時間を使える充実した日々を送っている。' },
    darkFuture: { title: '完璧主義が裏目に出て燃え尽きる', desc: '何でも一人で抱え込む癖が悪化し、過労で体調を崩してしまう。「もっと完璧に」と自分を追い込み続けた結果、仕事への情熱を失い、転職を繰り返す日々になっている。' },
  },
];

const GEMINI_FUTURE_MODEL = GEMINI_MODEL;

const analyzeFutureWithGemini = async (chatTextData, participantNames) => {
  if (!chatTextData || typeof chatTextData !== 'string' || chatTextData.trim().length === 0) {
    throw new Error('チャットデータがありません');
  }
  if (!participantNames?.length) {
    throw new Error('登場人物が検出されていません');
  }

  const textForAnalysis = chatTextData.substring(0, 30000);
  const namesList = participantNames.join('、');

  const prompt = `【指令】
提供されたLINEのチャットデータを分析し、登場人物それぞれの「5年後の未来」を予測してください。
出力にあたっては、以下のルールとフォーマットを厳守してください。

【生成ルール】
1. **断定的な口調**: 「〜かもしれません」「〜でしょう」といった推測表現は禁止です。「〜だ」「〜になる」「〜している」と、事実のように断定してください。
2. **3つの平行世界**: 各人物につき、以下の3つの未来を描いてください。
   - **光の未来 (Good Future)**: 本人の長所や特性が最大限にポジティブに作用し、大成功や幸福を掴んでいる最高の未来。
   - **現実の未来 (Realistic Future)**: 現状の延長線上にあり、劇的な変化はないが最も確実性が高い、堅実で納得感のある未来。
   - **闇の未来 (Bad Future)**: 本人の短所、口癖、性格の欠点が悪化し、トラブルや不運に見舞われている最悪の未来。

【対象の登場人物名】
${namesList}

【チャットデータ】
${textForAnalysis}

【出力形式】JSONの配列のみ。Markdownのコードブロックは不要。
[
  {
    "name": "登場人物名（チャットに登場する名前そのまま）",
    "lightFuture": { "title": "光の未来のキャッチ（30字程度）", "desc": "光の未来の説明（120字程度）" },
    "realisticFuture": { "title": "現実の未来のキャッチ（30字程度）", "desc": "現実の未来の説明（120字程度）" },
    "darkFuture": { "title": "闇の未来のキャッチ（30字程度）", "desc": "闇の未来の説明（120字程度）" }
  }
]
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_FUTURE_MODEL}:generateContent?key=${API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const errMsg = data?.error?.message || data?.error?.code || response.statusText;
      console.error('Gemini Future API Error:', data);
      throw new Error(errMsg || 'API Error');
    }

    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
      const blockReason = data.candidates?.[0]?.finishReason || data.candidates?.[0]?.safetyRatings;
      throw new Error(blockReason ? `応答がブロックされました: ${JSON.stringify(blockReason)}` : 'No response text');
    }

    resultText = resultText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(resultText);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('有効な分析結果が得られませんでした');

    return parsed.map((person) => ({
      name: person.name || '不明',
      lightFuture: {
        title: String(person.lightFuture?.title || '').slice(0, 60),
        desc: String(person.lightFuture?.desc || '').slice(0, 200),
      },
      realisticFuture: {
        title: String(person.realisticFuture?.title || '').slice(0, 60),
        desc: String(person.realisticFuture?.desc || '').slice(0, 200),
      },
      darkFuture: {
        title: String(person.darkFuture?.title || '').slice(0, 60),
        desc: String(person.darkFuture?.desc || '').slice(0, 200),
      },
    }));
  } catch (error) {
    console.error('Future Analysis Failed:', error);
    throw error;
  }
};

// --- サブコンポーネント定義 ---

// 左下固定の戻るボタン（ヘッダーなしレイアウト用）
const BACK_ICON_SRC = `${import.meta.env.BASE_URL}icon-back.svg`;

const BackButton = ({ screen, goBack }) => {
  if (screen === 'intro' || screen === 'selection') return null;
  return (
    <button
      onClick={goBack}
      className="fixed z-50 w-12 h-12 sm:w-[60px] sm:h-[60px] flex items-center justify-center rounded-full shadow-xl hover:scale-105 active:scale-95 transition-transform focus:outline-none touch-manipulation"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))', left: 'max(1rem, env(safe-area-inset-left))' }}
      aria-label="戻る"
    >
      <img src={BACK_ICON_SRC} alt="" className="w-full h-full object-contain" />
    </button>
  );
};

// 右下固定のルールボタン（ツール詳細画面以降で表示）
const RULE_BUTTON_SRC = `${import.meta.env.BASE_URL}button_rule.png`;

const RuleButton = ({ screen, onOpenRule }) => {
  const show = screen === 'details' || screen === 'input' || screen === 'analyzing' || screen === 'results' || screen === 'torisetsuResults' || screen === 'archiveAnalyzing' || screen === 'archiveResults' || screen === 'timelineAnalyzing' || screen === 'timelineResults' || screen === 'futureAnalyzing' || screen === 'futureResults';
  if (!show) return null;
  return (
    <button
      onClick={onOpenRule}
      className="fixed z-50 w-12 h-12 sm:w-[60px] sm:h-[60px] flex items-center justify-center rounded-full shadow-xl hover:scale-105 active:scale-95 transition-transform focus:outline-none touch-manipulation"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))', right: 'max(1rem, env(safe-area-inset-right))' }}
      aria-label="ルールを確認"
    >
      <img src={RULE_BUTTON_SRC} alt="" className="w-full h-full object-contain" />
    </button>
  );
};

// ルール確認モーダル（開いているツールのルールを表示・一番下にホームへ戻る）
const RuleModal = ({ selectedTool, screen, onClose, onGoHome }) => {
  const toolId = selectedTool?.id || 'finder';

  // データ投入画面以降では確認を取る
  const needsConfirmForGoHome = ['input', 'analyzing', 'results', 'torisetsuResults', 'archiveAnalyzing', 'archiveResults', 'timelineAnalyzing', 'timelineResults', 'futureAnalyzing', 'futureResults'].includes(screen);

  const handleGoHomeClick = () => {
    if (needsConfirmForGoHome && !window.confirm('本当にゲームを中断してホームへ戻りますか？')) {
      return;
    }
    onGoHome();
  };

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
              共通点をもとに盛り上がろう
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
              これまでの趣味を振り返ってみる
            </h4>
            <p className="text-xs leading-relaxed mb-2 text-gray-600">会話相手と自分の趣味嗜好がどのように移り変わってきたかを順を追って明らかにします。</p>
            <div className="bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden p-[21px]">
              <p className="text-[10px] text-[var(--black-mid)] font-bold mb-2">分析結果の例</p>
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-[var(--black-dark)] text-sm mb-1 flex items-center gap-2">
                    <span className="text-base" aria-hidden>🧸</span>
                    <span>くまのぬいぐるみ</span>
                  </h4>
                  <p className="text-xs text-[var(--black-mid)] mb-1">2024/08/15</p>
                  <p className="text-xs text-[var(--black-mid)] leading-relaxed">「この子かわいいよね、ずっと隣に置いてる」</p>
                </div>
                <div>
                  <h4 className="font-bold text-[var(--black-dark)] text-sm mb-1 flex items-center gap-2">
                    <span className="text-base" aria-hidden>⭐</span>
                    <span>推しのライブ</span>
                  </h4>
                  <p className="text-xs text-[var(--black-mid)] mb-1">2024/11/20</p>
                  <p className="text-xs text-[var(--black-mid)] leading-relaxed">「来月のライブ絶対行きたい！チケット取れた」</p>
                </div>
              </div>
            </div>
          </section>
        </>
      );
    }
    if (toolId === 'timeline') {
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
            <p className="text-xs leading-relaxed text-gray-600">2年以上会話している人とのチャットデータを用意しましょう。</p>
          </section>
          <section>
            <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
              <span className="bg-[#3986BB] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
              分析結果を見て昔を振り返る
            </h4>
            <p className="text-xs leading-relaxed mb-2 text-gray-600">1年ごとの関係性の変化が分かります。会話の量や言葉遣いなどから、横軸が西暦・縦軸が親密度の折れ線グラフを作成。各年にキャッチコピーと、実際の会話引用＋理由（各50字以内）を表示します。</p>
            <div className="bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden p-[21px]">
              <p className="text-[10px] text-[var(--black-mid)] font-bold mb-2">分析結果の例</p>
              <p className="text-[10px] text-[var(--black-mid)] font-medium mb-1">親密度の推移</p>
              <p className="text-[10px] text-[var(--black-light)] mb-3">2023年35 → 2024年65 → 2025年90 のように折れ線グラフで表示</p>
              <div className="space-y-3">
                <div>
                  <h4 className="font-bold text-[var(--black-dark)] text-sm mb-1">2023年：「互いへの敬意が育む、穏やかな信頼の芽生え」</h4>
                  <div className="space-y-1.5">
                    <div className="bg-white/80 rounded-xl p-2">
                      <p className="text-xs text-[var(--black-dark)]">葵「はじめまして！プロジェクトの資料、確認しました。よろしくお願いします！」</p>
                      <p className="text-[10px] text-[var(--black-light)] mt-0.5">敬語で礼儀正しく接しており、お互いにプロフェッショナルな距離感を保っているため。</p>
                    </div>
                    <div className="bg-white/80 rounded-xl p-2">
                      <p className="text-xs text-[var(--black-dark)]">健太「ありがとうございます。丁寧なフィードバックをいただけて心強いです。」</p>
                      <p className="text-[10px] text-[var(--black-light)] mt-0.5">共通の目的を持って協力し合い、徐々に信頼関係の土台を築き始めている段階であるため。</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-[var(--black-dark)] text-sm mb-1">2024年：「共通の趣味で加速する、共鳴と笑いの躍動期」</h4>
                  <div className="space-y-1.5">
                    <div className="bg-white/80 rounded-xl p-2">
                      <p className="text-xs text-[var(--black-dark)]">葵「健太くん、昨日のキャンプの写真送るね。次は星が綺麗なところ行こう！」</p>
                      <p className="text-[10px] text-[var(--black-light)] mt-0.5">ニックネームで呼び合い、プライベートな時間を共有して楽しんでいる様子が伺えるため。</p>
                    </div>
                    <div className="bg-white/80 rounded-xl p-2">
                      <p className="text-xs text-[var(--black-dark)]">健太「葵が撮ってくれた写真、どれも良すぎて壁紙にしたよ。次も楽しみ。」</p>
                      <p className="text-[10px] text-[var(--black-light)] mt-0.5">お互いの感性を認め合い、次の約束を自然に交わすほど心理的距離が近づいているため。</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      );
    }
    // ５年後の未来レポート
    return (
      <div className="space-y-4 text-gray-700">
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
            3つの未来を見て盛り上がる
          </h4>
          <p className="text-xs leading-relaxed mb-2 text-gray-600">
            分析結果はチャットの登場人数分のページを生成します。それぞれの人物について、「光の未来」「現実の未来」「闇の未来」の3つの平行世界が表示されます。
          </p>
          <div className="bg-white/20 rounded-[28px] shadow-xl overflow-hidden p-[21px]">
            <p className="text-[10px] text-[var(--black-mid)] font-bold mb-2">分析結果の例</p>
            <p className="text-sm font-bold text-[var(--black-dark)] mb-2">みずきの5年後の未来</p>
            <div className="space-y-3">
              <div className="bg-[#FFFEDF] rounded-xl p-2.5">
                <p className="font-bold text-[#444444] text-xs mb-0.5">✨ 光の未来</p>
                <p className="text-[10px] text-[#666666] leading-relaxed">デザイン×テクノロジーの架け橋となるクリエイター。大手IT企業のUXデザイナーとして活躍中。</p>
              </div>
              <div className="bg-[#FFFFFF] rounded-xl p-2.5">
                <p className="font-bold text-[#444444] text-xs mb-0.5">🌱 現実の未来</p>
                <p className="text-[10px] text-[#666666] leading-relaxed">着実にキャリアを積むデザイナー。仕事とプライベートのバランスを大切にした日々。</p>
              </div>
              <div className="bg-[#D4EDFF] rounded-xl p-2.5">
                <p className="font-bold text-[#444444] text-xs mb-0.5">🌪️ 闇の未来</p>
                <p className="text-[10px] text-[#666666] leading-relaxed">完璧主義が裏目に出て燃え尽きる。転職を繰り返す日々。</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  };

  const ruleTitle = selectedTool ? `${selectedTool.name} ルール` : 'ルール';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white/95 backdrop-blur-md rounded-[24px] sm:rounded-[32px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] max-w-md w-full max-h-[calc(85vh+20px)] overflow-hidden flex flex-col mx-2 sm:mx-4" onClick={e => e.stopPropagation()}>
        <div className="pt-6 sm:pt-8 px-4 sm:px-5 pb-2 relative flex items-center justify-center shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-[#134E78] text-center">{ruleTitle}</h2>
          <button onClick={onClose} className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 p-2 -m-2 rounded-full hover:bg-black/5 text-[var(--black-mid)] touch-manipulation" aria-label="閉じる">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 sm:p-[40px] pt-5 sm:pt-7 space-y-4 text-gray-700">
          {renderRuleContent()}
        </div>
        <div className="shrink-0 p-4 sm:p-5 pt-4 pb-6 pb-safe border-t border-gray-200/80">
          <button
            type="button"
            onClick={handleGoHomeClick}
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
const INTRO_LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;
const INTRO_GIF_SRC = `${import.meta.env.BASE_URL}intro.gif`;
const INTRO_BUTTON_SRC = `${import.meta.env.BASE_URL}button-hazimeru.svg`;

const IntroScreen = ({ setScreen }) => (
  <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 bg-transparent">
    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md bg-transparent">
      <img
        src={INTRO_LOGO_SRC}
        alt="wordig"
        className="w-full max-w-[240px] sm:max-w-[280px] object-contain bg-transparent mb-4 sm:mb-6"
      />
      <img
        src={INTRO_GIF_SRC}
        alt="くもぐら"
        className="w-full max-h-[35vh] sm:max-h-[40vh] object-contain bg-transparent"
      />
      <button
        type="button"
        onClick={() => setScreen('selection')}
        className="mt-6 sm:mt-8 w-full max-w-[180px] sm:max-w-[198px] hover:opacity-90 active:scale-95 transition-all focus:outline-none touch-manipulation"
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
    <h2 className="text-base sm:text-lg font-bold text-gray-700 py-3 px-4 sm:py-4 text-center shrink-0">使いたいツールを選んでね</h2>
    <div className="flex-1 overflow-y-auto px-3 sm:px-4 pb-6 pb-safe space-y-2 sm:space-y-3">
      {TOOLS.map((tool) => (
        <div
          key={tool.id}
          onClick={() => { setSelectedTool(tool); setScreen('details'); }}
          className="flex items-stretch gap-3 sm:gap-4 bg-white/20 backdrop-blur-sm rounded-[24px] sm:rounded-[30px] shadow-1 p-3 sm:p-4 min-h-[80px] sm:min-h-[100px] cursor-pointer hover:opacity-95 active:scale-[0.99] transition-all touch-manipulation"
        >
          {/* 左: アイコン（スマホでコンパクトに） */}
          <div className="w-[36%] min-w-[70px] max-w-[120px] sm:w-[45%] sm:max-w-[160px] shrink-0 flex items-center justify-center">
            <div className="aspect-square w-full max-h-[100px] sm:max-h-[130px] rounded-[16px] sm:rounded-[20px] flex items-center justify-center overflow-hidden">
              <img src={tool.icon} alt="" className="w-full h-full object-contain" />
            </div>
          </div>
          {/* 右: ピル（複数人プレイ/一人プレイ）→ タイトル → 説明文 */}
          <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5 sm:py-1 gap-1 sm:gap-1.5">
            {tool.type && (
              <span className="inline-flex items-center text-[10px] sm:text-xs font-medium text-[var(--blue-500)] bg-white border border-[var(--blue-500)] px-2 sm:px-3 py-0.5 sm:py-1 rounded-[10px] sm:rounded-[12px] w-fit">
                {tool.type}
              </span>
            )}
            <h3 className="font-bold text-[#134E78] text-sm sm:text-base leading-tight line-clamp-2">{tool.name}</h3>
            {tool.desc && (
              <p className="text-[11px] sm:text-xs text-[var(--black-mid)] leading-relaxed line-clamp-2">{tool.desc}</p>
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
  const isTimeline = selectedTool?.id === 'timeline';
  const isFuture = selectedTool?.id === 'future';

  return (
    <div className="p-4 sm:p-6 pb-24 pb-safe overflow-y-auto min-h-screen flex flex-col items-center">
      <div className="bg-white/20 backdrop-blur-md p-5 sm:p-8 rounded-[32px] sm:rounded-[40px] shadow-xl max-w-md w-full relative">
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
                  共通点をもとに盛り上がろう
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
                  これまでの趣味を振り返ってみる
                </h4>
                <p className="text-xs leading-relaxed mb-2 text-gray-600">会話相手と自分の趣味嗜好がどのように移り変わってきたかを順を追って明らかにします。</p>
                <div className="bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden p-[21px]">
                  <p className="text-[10px] text-[var(--black-mid)] font-bold mb-2">分析結果の例</p>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-bold text-[var(--black-dark)] text-sm mb-1 flex items-center gap-2">
                        <span className="text-base" aria-hidden>🧸</span>
                        <span>くまのぬいぐるみ</span>
                      </h4>
                      <p className="text-xs text-[var(--black-mid)] mb-1">2024/08/15</p>
                      <p className="text-xs text-[var(--black-mid)] leading-relaxed">「この子かわいいよね、ずっと隣に置いてる」</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-[var(--black-dark)] text-sm mb-1 flex items-center gap-2">
                        <span className="text-base" aria-hidden>⭐</span>
                        <span>推しのライブ</span>
                      </h4>
                      <p className="text-xs text-[var(--black-mid)] mb-1">2024/11/20</p>
                      <p className="text-xs text-[var(--black-mid)] leading-relaxed">「来月のライブ絶対行きたい！チケット取れた」</p>
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
        ) : isTimeline ? (
          <div className="space-y-6 text-gray-700">
            <div className="flex justify-center gap-4 text-sm font-bold text-gray-500">
              <span className="bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1"><Clock size={14}/> 3分</span>
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
                <p className="text-xs leading-relaxed text-gray-600">2年以上会話している人とのチャットデータを用意しましょう。</p>
              </section>

              <section>
                <h4 className="font-bold text-[#3986BB] text-sm mb-1 flex items-center gap-2">
                  <span className="bg-[#3986BB] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
                  分析結果を見て昔を振り返る
                </h4>
                <p className="text-xs leading-relaxed mb-2 text-gray-600">1年ごとの関係性の変化が分かります。会話の量や言葉遣いなどから、横軸が西暦・縦軸が親密度の折れ線グラフを作成。各年にキャッチコピーと、実際の会話引用＋理由（各50字以内）を表示します。親密度80%以上の年は背景色が反転して表示されます。</p>
                <div className="bg-white/20 rounded-[28px] shadow-xl overflow-hidden p-[21px]">
                  <p className="text-[10px] text-[var(--black-mid)] font-bold mb-3">分析結果の例</p>
                  {/* 親密度グラフ */}
                  {(() => {
                    const exYears = [2023, 2024, 2025];
                    const exScores = [35, 65, 90];
                    const gW = 240;
                    const gH = 80;
                    const pad = { top: 8, right: 8, bottom: 20, left: 28 };
                    const xScale = (i) => pad.left + (i / (exYears.length - 1)) * (gW - pad.left - pad.right);
                    const yScale = (v) => pad.top + gH - (Number(v) / 100) * (gH - pad.top - pad.bottom);
                    const pathD = exScores.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ');
                    return (
                      <div className="mb-4">
                        <p className="text-[10px] text-[var(--black-mid)] font-medium mb-2">親密度の推移</p>
                        <svg width={gW + pad.left + pad.right} height={gH + pad.bottom} className="overflow-visible w-full max-w-[280px]">
                          <line x1={pad.left} y1={pad.top} x2={pad.left} y2={gH} stroke="#B4D7EF" strokeWidth="1" />
                          <line x1={pad.left} y1={gH} x2={gW} y2={gH} stroke="#B4D7EF" strokeWidth="1" />
                          <text x={pad.left - 4} y={pad.top + 3} textAnchor="end" fontSize="9" fill="#666">100</text>
                          <text x={pad.left - 4} y={gH - 1} textAnchor="end" fontSize="9" fill="#666">0</text>
                          <path d={pathD} fill="none" stroke="var(--blue-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          {exYears.map((y, i) => (
                            <g key={i}>
                              <circle cx={xScale(i)} cy={yScale(exScores[i])} r="4" fill="var(--blue-500)" />
                              <text x={xScale(i)} y={gH + 14} textAnchor="middle" fontSize="10" fill="#666">{y}年</text>
                            </g>
                          ))}
                        </svg>
                      </div>
                    );
                  })()}
                  <div className="space-y-4">
                    {/* 2023年 35% */}
                    <div className="bg-white rounded-[20px] p-3 shadow-sm">
                      <h4 className="font-bold text-[var(--black-dark)] text-sm mb-2 flex items-center gap-2">
                        <span aria-hidden>🗓️</span>
                        <span>2023年：「互いへの敬意が育む、穏やかな信頼の芽生え」</span>
                      </h4>
                      <div className="space-y-2">
                        <div className="bg-[var(--blue-50)] rounded-xl p-2.5">
                          <p className="text-xs text-[var(--black-dark)] leading-relaxed font-medium">葵「はじめまして！プロジェクトの資料、確認しました。よろしくお願いします！」</p>
                          <p className="text-[10px] text-[var(--black-light)] mt-1">敬語で礼儀正しく接しており、お互いにプロフェッショナルな距離感を保っているため。</p>
                        </div>
                        <div className="bg-[var(--blue-50)] rounded-xl p-2.5">
                          <p className="text-xs text-[var(--black-dark)] leading-relaxed font-medium">健太「ありがとうございます。丁寧なフィードバックをいただけて心強いです。」</p>
                          <p className="text-[10px] text-[var(--black-light)] mt-1">共通の目的を持って協力し合い、徐々に信頼関係の土台を築き始めている段階であるため。</p>
                        </div>
                      </div>
                    </div>
                    {/* 2024年 65% */}
                    <div className="bg-white rounded-[20px] p-3 shadow-sm">
                      <h4 className="font-bold text-[var(--black-dark)] text-sm mb-2 flex items-center gap-2">
                        <span aria-hidden>🗓️</span>
                        <span>2024年：「共通の趣味で加速する、共鳴と笑いの躍動期」</span>
                      </h4>
                      <div className="space-y-2">
                        <div className="bg-[var(--blue-50)] rounded-xl p-2.5">
                          <p className="text-xs text-[var(--black-dark)] leading-relaxed font-medium">葵「健太くん、昨日のキャンプの写真送るね。次は星が綺麗なところ行こう！」</p>
                          <p className="text-[10px] text-[var(--black-light)] mt-1">ニックネームで呼び合い、プライベートな時間を共有して楽しんでいる様子が伺えるため。</p>
                        </div>
                        <div className="bg-[var(--blue-50)] rounded-xl p-2.5">
                          <p className="text-xs text-[var(--black-dark)] leading-relaxed font-medium">健太「葵が撮ってくれた写真、どれも良すぎて壁紙にしたよ。次も楽しみ。」</p>
                          <p className="text-[10px] text-[var(--black-light)] mt-1">お互いの感性を認め合い、次の約束を自然に交わすほど心理的距離が近づいているため。</p>
                        </div>
                      </div>
                    </div>
                    {/* 2025年 90% → 親密度80%以上で背景反転 */}
                    <div className="bg-[#7DBAE5]/50 rounded-[20px] p-3 shadow-sm">
                      <p className="text-xs font-bold text-[#134E78] text-center mb-2">親密度が80％に達しました</p>
                      <h4 className="font-bold text-[var(--black-dark)] text-sm mb-2 flex items-center gap-2">
                        <span aria-hidden>🗓️</span>
                        <span>2025年：「言葉を超えて支え合う、盤石な心のパートナー」</span>
                      </h4>
                      <div className="space-y-2">
                        <div className="bg-white rounded-xl p-2.5">
                          <p className="text-xs text-[var(--black-dark)] leading-relaxed font-medium">健太「今の仕事、本当は不安なんだ。葵にだけは正直に言っておきたくて。」</p>
                          <p className="text-[10px] text-[var(--black-light)] mt-1">弱みや不安を包み隠さず共有できる、精神的に非常に深い結びつきが生まれているため。</p>
                        </div>
                        <div className="bg-white rounded-xl p-2.5">
                          <p className="text-xs text-[var(--black-dark)] leading-relaxed font-medium">葵「健太なら大丈夫。何があっても私が全力で味方するから、信じて。」</p>
                          <p className="text-[10px] text-[var(--black-light)] mt-1">相手を無条件に肯定し、困難を共に乗り越えようとする強い絆と覚悟が感じられるため。</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        ) : isFuture ? (
          <div className="space-y-6 text-gray-700">
            <div className="flex justify-center gap-4 text-sm font-bold text-gray-500">
              <span className="bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1"><Clock size={14}/> 3分</span>
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
                  3つの未来を見て盛り上がる
                </h4>
                <p className="text-xs leading-relaxed mb-2 text-gray-600">
                  分析結果はチャットの登場人数分のページを生成します。それぞれの人物について、「光の未来」「現実の未来」「闇の未来」の3つの平行世界が表示されます。
                </p>
                <div className="bg-white/20 rounded-[28px] shadow-xl overflow-hidden p-[21px]">
                  <p className="text-[10px] text-[var(--black-mid)] font-bold mb-3">分析結果の例</p>
                  <p className="text-sm font-bold text-[var(--black-dark)] mb-2">みずきの5年後の未来</p>
                  <div className="space-y-4">
                    <div className="bg-[#FFFEDF] rounded-[20px] p-3 shadow-sm">
                      <h4 className="font-bold text-[#444444] text-sm mb-1 flex items-center gap-2">
                        <span aria-hidden>✨</span>
                        <span>光の未来</span>
                      </h4>
                      <p className="font-bold text-[#444444] text-xs mb-1">デザイン×テクノロジーの架け橋となるクリエイター</p>
                      <p className="text-xs text-[#666666] leading-relaxed">卒業後、大手IT企業のUXデザイナーとして就職。持ち前の実行力と技術力を活かし、ユーザーに寄り添ったプロダクトを次々と生み出している。社内では「課題解決の天才」として頼られ、チームリーダーとして活躍中。</p>
                    </div>
                    <div className="bg-[#FFFFFF] rounded-[20px] p-3 shadow-sm">
                      <h4 className="font-bold text-[#444444] text-sm mb-1 flex items-center gap-2">
                        <span aria-hidden>🌱</span>
                        <span>現実の未来</span>
                      </h4>
                      <p className="font-bold text-[#444444] text-xs mb-1">着実にキャリアを積むデザイナー</p>
                      <p className="text-xs text-[#666666] leading-relaxed">中小企業のデザイナーとして働きながら、自分のペースでスキルアップを続けている。仕事とプライベートのバランスを大切にし、趣味のプロジェクトにも時間を使える充実した日々を送っている。</p>
                    </div>
                    <div className="bg-[#D4EDFF] rounded-[20px] p-3 shadow-sm">
                      <h4 className="font-bold text-[#444444] text-sm mb-1 flex items-center gap-2">
                        <span aria-hidden>🌪️</span>
                        <span>闇の未来</span>
                      </h4>
                      <p className="font-bold text-[#444444] text-xs mb-1">完璧主義が裏目に出て燃え尽きる</p>
                      <p className="text-xs text-[#666666] leading-relaxed">何でも一人で抱え込む癖が悪化し、過労で体調を崩してしまう。「もっと完璧に」と自分を追い込み続けた結果、仕事への情熱を失い、転職を繰り返す日々になっている。</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
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
    <div 
      className="p-4 sm:p-6 max-w-lg mx-auto"
      style={{ paddingBottom: 'max(11rem, calc(7rem + env(safe-area-inset-bottom, 0px)))' }}
    >
      <h2 className="text-lg sm:text-xl font-bold text-gray-700 mb-2 text-center">チャットデータを投入しよう！</h2>
      <div className="flex justify-center mb-4 sm:mb-6">
        <img src={`${import.meta.env.BASE_URL}kumogura-shippo.gif`} alt="" className="max-w-full max-h-[260px] sm:max-h-[320px] w-full object-contain rounded-xl" />
      </div>
      <p className="text-center text-gray-500 text-sm mb-6 sm:mb-8">
        参加者の名前を入力して<br />
        txtファイルをアップロードしてね！<br />
        僕が分析するよ！
      </p>
      
      <div className="space-y-5">
        {participants.map((p, idx) => (
          <div key={p.id} className="rounded-[28px] sm:rounded-[33px] overflow-hidden shadow-md flex flex-col transition-all focus-within:ring-2 focus-within:ring-[#3986BB]/30 relative">
            {/* 背景レイヤー：入力未完了時のみ透明度20 */}
            <div className={`absolute inset-0 bg-white rounded-[28px] sm:rounded-[33px] transition-opacity duration-300 ${p.name.trim() && p.fileName ? 'opacity-100' : 'opacity-20'}`} />
            {/* コンテンツ：名前入力・データ追加ボタンは常に不透明度100 */}
            <div className="relative p-4 sm:p-[28px] flex flex-col gap-3 sm:gap-4">
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
                  className={`flex-1 h-[30px] px-4 rounded-[15px] ${p.name ? 'bg-[#E8F5FF]' : 'bg-white'} border-0 outline-none placeholder-gray-500 text-sm ${
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
                    src={p.fileName ? `${import.meta.env.BASE_URL}button_detachange.svg` : `${import.meta.env.BASE_URL}action_upload_file1.svg`}
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
                <div className={`flex-1 min-w-0 min-h-[30px] px-4 sm:px-[28px] rounded-[15px] flex items-center justify-center gap-2 overflow-hidden`}>
                  <FileText size={16} className={p.fileName ? 'text-[#2A5E83]' : 'text-gray-400'} shrink-0 />
                  <span className={`text-sm truncate min-w-0 ${p.fileName ? 'text-[#2A5E83] font-medium' : 'text-gray-500'}`}>
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

      <div 
        className="fixed left-0 right-0 flex justify-center px-4 sm:px-6 max-w-lg mx-auto"
        style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <button 
          disabled={!canGoNext}
          onClick={startAnalysis}
          className={`h-14 min-h-[56px] px-8 rounded-full font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 touch-manipulation ${
            canGoNext 
              ? 'bg-[var(--blue-500)] hover:opacity-90 cursor-pointer' 
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          <span>次へ進む</span>
          <ChevronLeft size={20} className="rotate-180 shrink-0" />
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
    <div 
      className="p-4 sm:p-6 max-w-lg mx-auto"
      style={{ paddingBottom: 'max(11rem, calc(7rem + env(safe-area-inset-bottom, 0px)))' }}
    >
      <h2 className="text-lg sm:text-xl font-bold text-gray-700 mb-2 text-center">チャットデータを投入しよう！</h2>
      <div className="flex justify-center mb-4 sm:mb-6">
        <img src={`${import.meta.env.BASE_URL}kumogura-shippo.gif`} alt="" className="max-w-full max-h-[260px] sm:max-h-[320px] w-full object-contain rounded-xl" />
      </div>
      <p className="text-center text-gray-500 text-sm mb-6 sm:mb-8">
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
          <div className="relative p-4 sm:p-[28px] flex flex-col gap-3 sm:gap-4">
            <p className="text-sm font-bold text-gray-700">チャットデータ</p>
            
            {/* ファイル名エリア: ボタン（左）＋ ファイル名 */}
            <div className="flex items-center gap-3 min-h-[44px]">
              <label className="cursor-pointer shrink-0 h-[30px] flex items-center justify-center hover:opacity-90 transition-opacity">
                <img
                  src={chatFileName ? `${import.meta.env.BASE_URL}button_detachange.svg` : `${import.meta.env.BASE_URL}action_upload_file1.svg`}
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
              <div className={`flex-1 min-w-0 min-h-[30px] px-4 sm:px-[28px] rounded-[15px] flex items-center justify-center gap-2 overflow-hidden`}>
                <FileText size={16} className={chatFileName ? 'text-[#2A5E83]' : 'text-gray-400'} shrink-0 />
                <span className={`text-sm truncate min-w-0 ${chatFileName ? 'text-[#2A5E83] font-medium' : 'text-gray-500'}`}>
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

      <div 
        className="fixed left-0 right-0 flex justify-center px-4 sm:px-6 max-w-lg mx-auto"
        style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <button 
          disabled={!canGoNextTorisetsu}
          onClick={() => startTorisetsuAnalysis(chatTextData, detectedParticipants)}
          className={`h-14 min-h-[56px] px-8 rounded-full font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 touch-manipulation ${
            canGoNextTorisetsu
              ? 'bg-[var(--blue-500)] hover:opacity-90 cursor-pointer' 
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          <span>次へ進む</span>
          <ChevronLeft size={20} className="rotate-180 shrink-0" />
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
    <div 
      className="p-4 sm:p-6 max-w-lg mx-auto"
      style={{ paddingBottom: 'max(11rem, calc(7rem + env(safe-area-inset-bottom, 0px)))' }}
    >
      <h2 className="text-lg sm:text-xl font-bold text-gray-700 mb-2 text-center">チャットデータを投入しよう！</h2>
      <div className="flex justify-center mb-4 sm:mb-6">
        <img src={`${import.meta.env.BASE_URL}kumogura-shippo.gif`} alt="" className="max-w-full max-h-[260px] sm:max-h-[320px] w-full object-contain rounded-xl" />
      </div>
      <p className="text-center text-gray-500 text-sm mb-6 sm:mb-8">
        趣味の話をしている友人や家族との<br />
        LINEトーク（txt）をアップロードしてね！<br />
        登場人物を自動で検出するよ！
      </p>

      <div className="space-y-5">
        <div className="rounded-[33px] overflow-hidden shadow-md flex flex-col transition-all focus-within:ring-2 focus-within:ring-[#3986BB]/30 relative">
          <div className={`absolute inset-0 bg-white rounded-[33px] transition-opacity duration-300 ${chatFileName ? 'opacity-100' : 'opacity-20'}`} />
          <div className="relative p-4 sm:p-[28px] flex flex-col gap-3 sm:gap-4">
            <p className="text-sm font-bold text-gray-700">チャットデータ</p>
            <div className="flex items-center gap-3 min-h-[44px]">
              <label className="cursor-pointer shrink-0 h-[30px] flex items-center justify-center hover:opacity-90 transition-opacity">
                <img
                  src={chatFileName ? `${import.meta.env.BASE_URL}button_detachange.svg` : `${import.meta.env.BASE_URL}action_upload_file1.svg`}
                  alt={chatFileName ? 'データを変更' : 'データを追加'}
                  className="h-[30px] w-auto"
                />
                <input type="file" accept=".txt" className="hidden" onChange={handleFileChange} />
              </label>
              <div className={`flex-1 min-w-0 min-h-[30px] px-4 sm:px-[28px] rounded-[15px] flex items-center justify-center gap-2 overflow-hidden`}>
                <FileText size={16} className={chatFileName ? 'text-[#2A5E83]' : 'text-gray-400'} shrink-0 />
                <span className={`text-sm truncate min-w-0 ${chatFileName ? 'text-[#2A5E83] font-medium' : 'text-gray-500'}`}>
                  {chatFileName || '追加されていません'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {isDetecting && (
          <div className="bg-white/90 rounded-[28px] sm:rounded-[33px] p-4 sm:p-6 shadow-md">
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

      <div 
        className="fixed left-0 right-0 flex justify-center px-4 sm:px-6 max-w-lg mx-auto"
        style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <button
          disabled={!canGoNextArchive}
          onClick={onStartArchive}
          className={`h-14 min-h-[56px] px-8 rounded-full font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 touch-manipulation ${
            canGoNextArchive ? 'bg-[var(--blue-500)] hover:opacity-90 cursor-pointer' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          <span>次へ進む</span>
          <ChevronLeft size={20} className="rotate-180 shrink-0" />
        </button>
      </div>
    </div>
  );
};

// ③ 関係性タイムライン専用: チャットデータ入力画面（1ファイル・登場人物自動検出・2年以上推奨）
const TimelineInputScreen = ({
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
  onStartTimeline,
  canGoNextTimeline,
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
    <div
      className="p-4 sm:p-6 max-w-lg mx-auto"
      style={{ paddingBottom: 'max(11rem, calc(7rem + env(safe-area-inset-bottom, 0px)))' }}
    >
      <h2 className="text-lg sm:text-xl font-bold text-gray-700 mb-2 text-center">チャットデータを投入しよう！</h2>
      <div className="flex justify-center mb-4 sm:mb-6">
        <img src={`${import.meta.env.BASE_URL}kumogura-shippo.gif`} alt="" className="max-w-full max-h-[260px] sm:max-h-[320px] w-full object-contain rounded-xl" />
      </div>
      <p className="text-center text-gray-500 text-sm mb-6 sm:mb-8">
        2年以上会話している人との<br />
        LINEトーク（txt）をアップロードしてね！<br />
        登場人物を自動で検出するよ！
      </p>

      <div className="space-y-5">
        <div className="rounded-[33px] overflow-hidden shadow-md flex flex-col transition-all focus-within:ring-2 focus-within:ring-[#3986BB]/30 relative">
          <div className={`absolute inset-0 bg-white rounded-[33px] transition-opacity duration-300 ${chatFileName ? 'opacity-100' : 'opacity-20'}`} />
          <div className="relative p-4 sm:p-[28px] flex flex-col gap-3 sm:gap-4">
            <p className="text-sm font-bold text-gray-700">チャットデータ</p>
            <div className="flex items-center gap-3 min-h-[44px]">
              <label className="cursor-pointer shrink-0 h-[30px] flex items-center justify-center hover:opacity-90 transition-opacity">
                <img
                  src={chatFileName ? `${import.meta.env.BASE_URL}button_detachange.svg` : `${import.meta.env.BASE_URL}action_upload_file1.svg`}
                  alt={chatFileName ? 'データを変更' : 'データを追加'}
                  className="h-[30px] w-auto"
                />
                <input type="file" accept=".txt" className="hidden" onChange={handleFileChange} />
              </label>
              <div className={`flex-1 min-w-0 min-h-[30px] px-4 sm:px-[28px] rounded-[15px] flex items-center justify-center gap-2 overflow-hidden`}>
                <FileText size={16} className={chatFileName ? 'text-[#2A5E83]' : 'text-gray-400'} shrink-0 />
                <span className={`text-sm truncate min-w-0 ${chatFileName ? 'text-[#2A5E83] font-medium' : 'text-gray-500'}`}>
                  {chatFileName || '追加されていません'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {isDetecting && (
          <div className="bg-white/90 rounded-[28px] sm:rounded-[33px] p-4 sm:p-6 shadow-md">
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

      <div
        className="fixed left-0 right-0 flex justify-center px-4 sm:px-6 max-w-lg mx-auto"
        style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <button
          disabled={!canGoNextTimeline}
          onClick={onStartTimeline}
          className={`h-14 min-h-[56px] px-8 rounded-full font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 touch-manipulation ${
            canGoNextTimeline ? 'bg-[var(--blue-500)] hover:opacity-90 cursor-pointer' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          <span>分析をはじめる</span>
          <ChevronLeft size={20} className="rotate-180 shrink-0" />
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
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow w-32 opacity-40 top-[15%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-2 w-24 opacity-30 top-[35%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-3 w-28 opacity-35 top-[55%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow w-20 opacity-25 top-[70%] mix-blend-screen" style={{ animationDelay: '-45s' }} />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-2 w-36 opacity-30 top-[25%] mix-blend-screen" style={{ animationDelay: '-15s' }} />
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
            src={`${import.meta.env.BASE_URL}kumogura-shippo.gif`}
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
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow w-32 opacity-40 top-[15%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-2 w-24 opacity-30 top-[35%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-3 w-28 opacity-35 top-[55%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow w-20 opacity-25 top-[70%] mix-blend-screen" style={{ animationDelay: '-45s' }} />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-2 w-36 opacity-30 top-[25%] mix-blend-screen" style={{ animationDelay: '-15s' }} />
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

// 関係性タイムライン分析中にくもぐらが話すセリフ
const KUMOGURA_TIMELINE_ANALYZING_LINES = [
  '関係性の変化、分析してるよ',
  'どんな年があったかな？',
  '親密度の変化、見えてきたよ',
  'もう少し待ってね',
  '昔を振り返る結果、できてきたよ',
  '二人の歩み、わかったよ',
];

// ④ 関係性タイムライン専用: 分析中画面
const TimelineAnalyzingScreen = ({ analysisStatus, analysisProgress }) => {
  const [speechVisible, setSpeechVisible] = useState(true);
  const [speechIndex, setSpeechIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setSpeechVisible((v) => {
        if (!v) setSpeechIndex((i) => (i + 1) % KUMOGURA_TIMELINE_ANALYZING_LINES.length);
        return !v;
      });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const currentLine = KUMOGURA_TIMELINE_ANALYZING_LINES[speechIndex];

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-transparent">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow w-32 opacity-40 top-[15%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-2 w-24 opacity-30 top-[35%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-3 w-28 opacity-35 top-[55%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow w-20 opacity-25 top-[70%] mix-blend-screen" style={{ animationDelay: '-45s' }} />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-2 w-36 opacity-30 top-[25%] mix-blend-screen" style={{ animationDelay: '-15s' }} />
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
            src={`${import.meta.env.BASE_URL}kumogura-shippo.gif`}
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

// ⑤ 関係性タイムライン専用: 分析結果画面（折れ線グラフ＋年別キャッチコピー・引用・理由）
const TimelineResultsScreen = ({ resultsData, apiError }) => {
  const { years = [], intimacyScores = [], yearlyData = [] } = resultsData || {};
  const hasGraph = years.length > 0 && intimacyScores.length === years.length;

  const graphWidth = 280;
  const graphHeight = 120;
  const padding = { top: 10, right: 10, bottom: 25, left: 35 };

  const minScore = 0;
  const maxScore = 100;
  const range = maxScore - minScore;

  const xScale = (i) => {
    if (years.length <= 1) return padding.left + graphWidth / 2;
    return padding.left + (i / (years.length - 1)) * (graphWidth - padding.left - padding.right);
  };
  const yScale = (v) => {
    const clamped = Math.max(0, Math.min(100, Number(v) || 0));
    return padding.top + graphHeight - (clamped / range) * (graphHeight - padding.top - padding.bottom);
  };

  const pathD = intimacyScores
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`)
    .join(' ');

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-transparent">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow w-32 opacity-40 top-[15%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-2 w-24 opacity-30 top-[35%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-3 w-28 opacity-35 top-[55%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow w-20 opacity-25 top-[70%] mix-blend-screen" style={{ animationDelay: '-45s' }} />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-2 w-36 opacity-30 top-[25%] mix-blend-screen" style={{ animationDelay: '-15s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4 flex flex-col h-[90vh] py-4">
        <div className="w-full flex-1 min-h-0 flex flex-col bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden">
          <div className="shrink-0 p-5 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={22} className="text-[var(--blue-500)] shrink-0" />
              <h2 className="text-lg font-bold text-gray-800">関係性タイムライン</h2>
            </div>
            {apiError && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                <Info size={16} className="text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800">{apiError}（例の結果を表示しています）</p>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
            {hasGraph && (
              <section className="bg-white rounded-[28px] shadow-lg overflow-hidden p-4">
                <h4 className="font-bold text-[var(--black-dark)] text-sm mb-3">親密度の推移</h4>
                <div className="flex justify-center">
                  <svg width={graphWidth + padding.left + padding.right} height={graphHeight + padding.bottom} className="overflow-visible">
                    <line x1={padding.left} y1={padding.top} x2={padding.left} y2={graphHeight} stroke="#B4D7EF" strokeWidth="1" />
                    <line x1={padding.left} y1={graphHeight} x2={graphWidth} y2={graphHeight} stroke="#B4D7EF" strokeWidth="1" />
                    <text x={padding.left - 5} y={padding.top + 4} textAnchor="end" fontSize="10" fill="#666">100</text>
                    <text x={padding.left - 5} y={graphHeight - 2} textAnchor="end" fontSize="10" fill="#666">0</text>
                    <path d={pathD} fill="none" stroke="var(--blue-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    {years.map((y, i) => (
                      <g key={i}>
                        <circle cx={xScale(i)} cy={yScale(intimacyScores[i] ?? 0)} r="5" fill="var(--blue-500)" />
                        <text x={xScale(i)} y={graphHeight + 18} textAnchor="middle" fontSize="11" fill="#666">{y}年</text>
                      </g>
                    ))}
                  </svg>
                </div>
              </section>
            )}

            {yearlyData.map((item, index) => {
              const intimacy = intimacyScores[index];
              const isHighIntimacy = typeof intimacy === 'number' && intimacy >= 80;
              return (
                <section key={index} className={`rounded-[28px] shadow-lg overflow-hidden p-4 ${isHighIntimacy ? 'bg-[#7DBAE5]/50' : 'bg-white'}`}>
                  {isHighIntimacy && <p className="text-xs font-bold text-[#134E78] text-center mb-2">親密度が80％に達しました</p>}
                  <h4 className="font-bold text-[var(--black-dark)] text-sm mb-2 flex items-center gap-2">
                    <span className="text-base" aria-hidden>🗓️</span>
                    <span>{item.year}年：「{item.catchphrase}」</span>
                  </h4>
                  <div className="space-y-3">
                    {(item.quotes || []).map((q, qi) => (
                      <div key={qi} className={`rounded-xl p-3 ${isHighIntimacy ? 'bg-white' : 'bg-[var(--blue-50)]'}`}>
                        <p className="text-xs text-[var(--black-dark)] leading-relaxed font-medium">{q.quote}</p>
                        <p className="text-[10px] text-[var(--black-light)] mt-1">{q.reason}</p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
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
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow w-32 opacity-40 top-[15%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-2 w-24 opacity-30 top-[35%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-3 w-28 opacity-35 top-[55%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow w-20 opacity-25 top-[70%] mix-blend-screen" style={{ animationDelay: '-45s' }} />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-2 w-36 opacity-30 top-[25%] mix-blend-screen" style={{ animationDelay: '-15s' }} />
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
            src={`${import.meta.env.BASE_URL}kumogura-shippo.gif`}
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
      <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow w-32 opacity-40 top-[15%] mix-blend-screen" />
      <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-2 w-24 opacity-30 top-[35%] mix-blend-screen" />
      <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-3 w-28 opacity-35 top-[55%] mix-blend-screen" />
      <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow w-20 opacity-25 top-[70%] mix-blend-screen" style={{ animationDelay: '-45s' }} />
      <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-2 w-36 opacity-30 top-[25%] mix-blend-screen" style={{ animationDelay: '-15s' }} />
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

          {/* 待ち時間のお題（分析結果では共通点ごとに「話すときのお題」が表示されます） */}
          <p className="text-xs text-gray-600 mb-2">分析結果では、共通点ごとに「話すときのお題」が表示されます。</p>
          <div className="bg-white rounded-2xl p-4 shadow-lg">
            <p className="text-xs text-gray-500 font-bold mb-2">待ち時間のアイスブレイクお題</p>
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
const CLOUD_SRC = `${import.meta.env.BASE_URL}cloud.png`;

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

      {/* カード: 縦中央・下余白で固定ボタンと重ならないように（スマホ対応） */}
      <div className="relative z-10 w-full max-w-md mx-4 flex flex-col items-center pb-[max(5rem,calc(4rem+env(safe-area-inset-bottom)))]">
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
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow w-32 opacity-40 top-[15%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-2 w-24 opacity-30 top-[35%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-3 w-28 opacity-35 top-[55%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow w-20 opacity-25 top-[70%] mix-blend-screen" style={{ animationDelay: '-45s' }} />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-2 w-36 opacity-30 top-[25%] mix-blend-screen" style={{ animationDelay: '-15s' }} />
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

// ５年後の未来レポート分析中にくもぐらが話すセリフ
const KUMOGURA_FUTURE_ANALYZING_LINES = [
  '5年後の未来、分析してるよ',
  '光と闇、どっちが来るかな？',
  '3つの世界、見えてきたよ',
  'もう少し待ってね',
  '未来レポート、できてきたよ',
  '君の可能性、わかったよ',
];

// ④ ５年後の未来レポート専用: 分析中画面
const FutureAnalyzingScreen = ({ analysisStatus, analysisProgress }) => {
  const [speechVisible, setSpeechVisible] = useState(true);
  const [speechIndex, setSpeechIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setSpeechVisible((v) => {
        if (!v) setSpeechIndex((i) => (i + 1) % KUMOGURA_FUTURE_ANALYZING_LINES.length);
        return !v;
      });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const currentLine = KUMOGURA_FUTURE_ANALYZING_LINES[speechIndex];

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-transparent">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow w-32 opacity-40 top-[15%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-2 w-24 opacity-30 top-[35%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-3 w-28 opacity-35 top-[55%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow w-20 opacity-25 top-[70%] mix-blend-screen" style={{ animationDelay: '-45s' }} />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-2 w-36 opacity-30 top-[25%] mix-blend-screen" style={{ animationDelay: '-15s' }} />
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
            src={`${import.meta.env.BASE_URL}kumogura-shippo.gif`}
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

// ⑤ ５年後の未来レポート専用: 分析結果画面（登場人数分のページ・光/現実/闇の3つの未来）
const FutureResultsScreen = ({ resultPage, setResultPage, resultsData, totalPages, apiError }) => {
  const currentPerson = resultsData[resultPage - 1] || resultsData[0];
  if (!currentPerson) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-transparent">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow w-32 opacity-40 top-[15%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-2 w-24 opacity-30 top-[35%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-3 w-28 opacity-35 top-[55%] mix-blend-screen" />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow w-20 opacity-25 top-[70%] mix-blend-screen" style={{ animationDelay: '-45s' }} />
        <img src={`${import.meta.env.BASE_URL}cloud.png`} alt="" className="absolute cloud-flow-2 w-36 opacity-30 top-[25%] mix-blend-screen" style={{ animationDelay: '-15s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4 flex flex-col items-center h-[90vh] py-4">
        <div
          key={resultPage}
          className="w-full flex-1 min-h-0 flex flex-col bg-[var(--blue-50)] rounded-[28px] shadow-xl overflow-hidden animate-in fade-in slide-in-from-right-8 duration-500"
        >
          <div className="shrink-0 p-5 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={22} className="text-[var(--blue-500)] shrink-0" />
              <h2 className="text-lg font-bold text-gray-800">{currentPerson.name}の5年後の未来</h2>
            </div>
            {apiError && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                <Info size={16} className="text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800">{apiError}（例の結果を表示しています）</p>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
            {/* 光の未来＝FFFEDF 100% */}
            <section>
              <h4 className="font-bold text-[#134E78] text-sm mb-1 flex items-center gap-2">
                <span className="text-lg" aria-hidden>✨</span>
                光の未来
              </h4>
              <div className="bg-[#FFFEDF] rounded-[28px] shadow-lg overflow-hidden p-4">
                <h4 className="font-bold text-[#444444] text-sm mb-1">{currentPerson.lightFuture?.title}</h4>
                <p className="text-xs text-[#666666] leading-relaxed">{currentPerson.lightFuture?.desc}</p>
              </div>
            </section>
            {/* 現実の未来＝白 100% */}
            <section>
              <h4 className="font-bold text-[#134E78] text-sm mb-1 flex items-center gap-2">
                <span className="text-lg" aria-hidden>🌱</span>
                現実の未来
              </h4>
              <div className="bg-[#FFFFFF] rounded-[28px] shadow-lg overflow-hidden p-4">
                <h4 className="font-bold text-[#444444] text-sm mb-1">{currentPerson.realisticFuture?.title}</h4>
                <p className="text-xs text-[#666666] leading-relaxed">{currentPerson.realisticFuture?.desc}</p>
              </div>
            </section>
            {/* 闇の未来＝青 134E78 60%・文字白 */}
            <section>
              <h4 className="font-bold text-[#134E78] text-sm mb-1 flex items-center gap-2">
                <span className="text-lg" aria-hidden>🌪️</span>
                闇の未来
              </h4>
              <div className="bg-[#D4EDFF] rounded-[28px] shadow-lg overflow-hidden p-4">
                <h4 className="font-bold text-[#444444] text-sm mb-1">{currentPerson.darkFuture?.title}</h4>
                <p className="text-xs text-[#666666] leading-relaxed">{currentPerson.darkFuture?.desc}</p>
              </div>
            </section>
          </div>

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

// ③ ５年後の未来レポート専用: チャットデータ入力画面（1ファイル・登場人物自動検出）
const FutureInputScreen = ({
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
  onStartFuture,
  canGoNextFuture,
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
    <div
      className="p-4 sm:p-6 max-w-lg mx-auto"
      style={{ paddingBottom: 'max(11rem, calc(7rem + env(safe-area-inset-bottom, 0px)))' }}
    >
      <h2 className="text-lg sm:text-xl font-bold text-gray-700 mb-2 text-center">チャットデータを投入しよう！</h2>
      <div className="flex justify-center mb-4 sm:mb-6">
        <img src={`${import.meta.env.BASE_URL}kumogura-shippo.gif`} alt="" className="max-w-full max-h-[260px] sm:max-h-[320px] w-full object-contain rounded-xl" />
      </div>
      <p className="text-center text-gray-500 text-sm mb-6 sm:mb-8">
        チャットデータを投入すると、<br />
        登場人物を自動で検出するよ！<br />
        5年後の「光・現実・闇」の3つの未来を分析するね！
      </p>

      <div className="space-y-5">
        <div className="rounded-[33px] overflow-hidden shadow-md flex flex-col transition-all focus-within:ring-2 focus-within:ring-[#3986BB]/30 relative">
          <div className={`absolute inset-0 bg-white rounded-[33px] transition-opacity duration-300 ${chatFileName ? 'opacity-100' : 'opacity-20'}`} />
          <div className="relative p-4 sm:p-[28px] flex flex-col gap-3 sm:gap-4">
            <p className="text-sm font-bold text-gray-700">チャットデータ</p>
            <div className="flex items-center gap-3 min-h-[44px]">
              <label className="cursor-pointer shrink-0 h-[30px] flex items-center justify-center hover:opacity-90 transition-opacity">
                <img
                  src={chatFileName ? `${import.meta.env.BASE_URL}button_detachange.svg` : `${import.meta.env.BASE_URL}action_upload_file1.svg`}
                  alt={chatFileName ? 'データを変更' : 'データを追加'}
                  className="h-[30px] w-auto"
                />
                <input type="file" accept=".txt" className="hidden" onChange={handleFileChange} />
              </label>
              <div className={`flex-1 min-w-0 min-h-[30px] px-4 sm:px-[28px] rounded-[15px] flex items-center justify-center gap-2 overflow-hidden`}>
                <FileText size={16} className={chatFileName ? 'text-[#2A5E83]' : 'text-gray-400'} shrink-0 />
                <span className={`text-sm truncate min-w-0 ${chatFileName ? 'text-[#2A5E83] font-medium' : 'text-gray-500'}`}>
                  {chatFileName || '追加されていません'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {isDetecting && (
          <div className="bg-white/90 rounded-[28px] sm:rounded-[33px] p-4 sm:p-6 shadow-md">
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

      <div
        className="fixed left-0 right-0 flex justify-center px-4 sm:px-6 max-w-lg mx-auto"
        style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <button
          disabled={!canGoNextFuture}
          onClick={onStartFuture}
          className={`h-14 min-h-[56px] px-8 rounded-full font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 touch-manipulation ${
            canGoNextFuture ? 'bg-[var(--blue-500)] hover:opacity-90 cursor-pointer' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          <span>次へ進む</span>
          <ChevronLeft size={20} className="rotate-180 shrink-0" />
        </button>
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

  const [timelineChatFileName, setTimelineChatFileName] = useState('');
  const [timelineChatTextData, setTimelineChatTextData] = useState('');
  const [timelineDetectedParticipants, setTimelineDetectedParticipants] = useState([]);
  const [timelineIsDetecting, setTimelineIsDetecting] = useState(false);
  const [timelineDetectionProgress, setTimelineDetectionProgress] = useState(0);
  const [timelineExtractionError, setTimelineExtractionError] = useState(null);
  const [timelineIsExtractingParticipants, setTimelineIsExtractingParticipants] = useState(false);
  const [timelineAnalysisProgress, setTimelineAnalysisProgress] = useState(0);
  const [timelineAnalysisStatus, setTimelineAnalysisStatus] = useState('データ読み込み中...');
  const [timelineResultsData, setTimelineResultsData] = useState(DEFAULT_TIMELINE_RESULTS);
  const [timelineApiError, setTimelineApiError] = useState(null);

  // ５年後の未来レポート用の状態
  const [futureChatFileName, setFutureChatFileName] = useState('');
  const [futureChatTextData, setFutureChatTextData] = useState('');
  const [futureDetectedParticipants, setFutureDetectedParticipants] = useState([]);
  const [futureIsDetecting, setFutureIsDetecting] = useState(false);
  const [futureDetectionProgress, setFutureDetectionProgress] = useState(0);
  const [futureExtractionError, setFutureExtractionError] = useState(null);
  const [futureIsExtractingParticipants, setFutureIsExtractingParticipants] = useState(false);
  const [futureAnalysisProgress, setFutureAnalysisProgress] = useState(0);
  const [futureAnalysisStatus, setFutureAnalysisStatus] = useState('データ読み込み中...');
  const [futureResultsData, setFutureResultsData] = useState(DEFAULT_FUTURE_RESULTS);
  const [futureApiError, setFutureApiError] = useState(null);
  const [futureResultPage, setFutureResultPage] = useState(1);

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
    backgroundAttachment: 'fixed', /* スクロール時も背景をビューポートに固定し、白い隙間を見せない */
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
    else if (screen === 'timelineResults' || screen === 'timelineAnalyzing') setScreen('input');
    else if (screen === 'futureResults' || screen === 'futureAnalyzing') setScreen('input');
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
  const isTimelineFlow = selectedTool?.id === 'timeline';
  const isFutureFlow = selectedTool?.id === 'future';

  const canGoNextArchive = archiveChatFileName && archiveDetectedParticipants.length >= 1 && !archiveIsDetecting && !archiveIsExtractingParticipants;
  const canGoNextTimeline = timelineChatFileName && timelineDetectedParticipants.length >= 1 && !timelineIsDetecting && !timelineIsExtractingParticipants;
  const canGoNextFuture = futureChatFileName && futureDetectedParticipants.length >= 1 && !futureIsDetecting && !futureIsExtractingParticipants;

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

  const handleTimelineExtractWithAI = async () => {
    if (!timelineChatTextData?.trim()) return;
    setTimelineIsExtractingParticipants(true);
    setTimelineExtractionError(null);
    try {
      const names = await extractParticipantsWithGemini(timelineChatTextData);
      setTimelineDetectedParticipants(names);
      if (names.length === 0) setTimelineExtractionError('登場人物を検出できませんでした。別の形式のテキストをお試しください。');
    } catch (e) {
      console.error(e);
      setTimelineExtractionError(e?.message || 'AIでの検出に失敗しました');
    } finally {
      setTimelineIsExtractingParticipants(false);
    }
  };

  const startTimelineAnalysis = async () => {
    const chatText = timelineChatTextData;
    const names = timelineDetectedParticipants;
    if (!chatText?.trim() || !names?.length) return;

    setScreen('timelineAnalyzing');
    setTimelineAnalysisProgress(0);
    setTimelineAnalysisStatus('分析を開始...');
    setTimelineApiError(null);

    const uiInterval = setInterval(() => {
      setTimelineAnalysisProgress((prev) => (prev >= 90 ? 90 : prev + 2));
    }, 50);

    setTimelineAnalysisStatus('AIが関係性の変化を分析中...');

    try {
      const results = await analyzeTimelineWithGemini(chatText, names);
      setTimelineResultsData(results);
      setTimelineApiError(null);
    } catch (e) {
      console.error('関係性タイムライン分析エラー:', e);
      setTimelineApiError(e?.message || 'AI分析に失敗しました');
      setTimelineResultsData(DEFAULT_TIMELINE_RESULTS);
    }

    clearInterval(uiInterval);
    setTimelineAnalysisProgress(100);
    setTimelineAnalysisStatus('分析完了！');
    setTimeout(() => setScreen('timelineResults'), 1000);
  };

  const handleFutureExtractWithAI = async () => {
    if (!futureChatTextData?.trim()) return;
    setFutureIsExtractingParticipants(true);
    setFutureExtractionError(null);
    try {
      const names = await extractParticipantsWithGemini(futureChatTextData);
      setFutureDetectedParticipants(names);
      if (names.length === 0) setFutureExtractionError('登場人物を検出できませんでした。別の形式のテキストをお試しください。');
    } catch (e) {
      console.error(e);
      setFutureExtractionError(e?.message || 'AIでの検出に失敗しました');
    } finally {
      setFutureIsExtractingParticipants(false);
    }
  };

  const startFutureAnalysis = async () => {
    const chatText = futureChatTextData;
    const names = futureDetectedParticipants;
    if (!chatText?.trim() || !names?.length) return;

    setScreen('futureAnalyzing');
    setFutureAnalysisProgress(0);
    setFutureAnalysisStatus('分析を開始...');
    setFutureApiError(null);
    setFutureResultPage(1);

    const uiInterval = setInterval(() => {
      setFutureAnalysisProgress((prev) => (prev >= 90 ? 90 : prev + 2));
    }, 50);

    setFutureAnalysisStatus('AIが5年後の未来を分析中...');

    try {
      const results = await analyzeFutureWithGemini(chatText, names);
      setFutureResultsData(results);
      setFutureApiError(null);
    } catch (e) {
      console.error('5年後の未来レポート分析エラー:', e);
      setFutureApiError(e?.message || 'AI分析に失敗しました');
      setFutureResultsData(DEFAULT_FUTURE_RESULTS);
    }

    clearInterval(uiInterval);
    setFutureAnalysisProgress(100);
    setFutureAnalysisStatus('分析完了！');
    setTimeout(() => setScreen('futureResults'), 1000);
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

        {/* 関係性タイムラインのフロー */}
        {screen === 'input' && isTimelineFlow && (
          <TimelineInputScreen
            chatFileName={timelineChatFileName}
            setChatFileName={setTimelineChatFileName}
            chatTextData={timelineChatTextData}
            setChatTextData={setTimelineChatTextData}
            detectedParticipants={timelineDetectedParticipants}
            setDetectedParticipants={setTimelineDetectedParticipants}
            isDetecting={timelineIsDetecting}
            setIsDetecting={setTimelineIsDetecting}
            detectionProgress={timelineDetectionProgress}
            setDetectionProgress={setTimelineDetectionProgress}
            onStartTimeline={startTimelineAnalysis}
            canGoNextTimeline={canGoNextTimeline}
            onExtractWithAI={handleTimelineExtractWithAI}
            isExtractingParticipants={timelineIsExtractingParticipants}
            extractionError={timelineExtractionError}
            setExtractionError={setTimelineExtractionError}
          />
        )}
        {screen === 'timelineAnalyzing' && isTimelineFlow && (
          <TimelineAnalyzingScreen analysisStatus={timelineAnalysisStatus} analysisProgress={timelineAnalysisProgress} />
        )}
        {screen === 'timelineResults' && isTimelineFlow && (
          <TimelineResultsScreen resultsData={timelineResultsData} apiError={timelineApiError} />
        )}

        {/* ５年後の未来レポートのフロー */}
        {screen === 'input' && isFutureFlow && (
          <FutureInputScreen
            chatFileName={futureChatFileName}
            setChatFileName={setFutureChatFileName}
            chatTextData={futureChatTextData}
            setChatTextData={setFutureChatTextData}
            detectedParticipants={futureDetectedParticipants}
            setDetectedParticipants={setFutureDetectedParticipants}
            isDetecting={futureIsDetecting}
            setIsDetecting={setFutureIsDetecting}
            detectionProgress={futureDetectionProgress}
            setDetectionProgress={setFutureDetectionProgress}
            onStartFuture={startFutureAnalysis}
            canGoNextFuture={canGoNextFuture}
            onExtractWithAI={handleFutureExtractWithAI}
            isExtractingParticipants={futureIsExtractingParticipants}
            extractionError={futureExtractionError}
            setExtractionError={setFutureExtractionError}
          />
        )}
        {screen === 'futureAnalyzing' && isFutureFlow && (
          <FutureAnalyzingScreen analysisStatus={futureAnalysisStatus} analysisProgress={futureAnalysisProgress} />
        )}
        {screen === 'futureResults' && isFutureFlow && (
          <FutureResultsScreen
            resultPage={futureResultPage}
            setResultPage={setFutureResultPage}
            resultsData={futureResultsData}
            totalPages={futureResultsData.length}
            apiError={futureApiError}
          />
        )}
      </main>
      <BackButton screen={screen} goBack={goBack} />
      <RuleButton screen={screen} onOpenRule={() => setShowRuleModal(true)} />
      {screen === 'results' && showRuleHint && (
        <div 
          className={`fixed z-50 max-w-[220px] sm:max-w-[240px] transition-opacity duration-[2000ms] ease-out ${ruleHintFading ? 'opacity-0' : 'opacity-100'}`}
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))', right: 'max(1rem, env(safe-area-inset-right))' }}
        >
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
          screen={screen}
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
