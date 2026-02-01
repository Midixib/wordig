# エンジニアじゃなくてもできる！GitHub → Vercel デプロイ手順

プログラミングが初めてでも、この手順に沿えばWebサイトを公開できます。  
**「何をしているか」** を短く説明しながら進めるので、安心してやってみてください。

---

## この手順でできること

1. **GitHub** … あなたのプログラム（コード）をオンラインで保管する場所
2. **Vercel** … そのコードを「本物のWebサイト」として世界中に公開するサービス

**流れのイメージ：**  
自分のPCで作ったサイト → GitHubにアップロード → Vercelがそれを拾って公開 → 誰でもURLで見られる

---

## 事前に用意するもの（無料）

| もの | 説明 | リンク |
|------|------|--------|
| **GitHubアカウント** | コードを置く場所の会員証 | https://github.com/signup |
| **Vercelアカウント** | サイトを公開するサービスの会員証 | https://vercel.com/signup |
| **Git** | コードをGitHubに送るためのソフト（後述でインストール） | — |

※ GitHubで登録したら、Vercelは「GitHubでログイン」を選ぶと楽です。

---

# パート1：GitHubにコードを上げる

## ステップ1：Gitをインストールする（まだの人だけ）

1. 次のサイトを開く：  
   **https://git-scm.com/download/win**
2. 「Click here to download」など、**Windows用のダウンロード**をクリック。
3. ダウンロードした **.exe** を実行。
4. 基本的には「Next」のまま進めてOK。全部終わったら **「Finish」**。
5. **PCを一度再起動**するか、Cursor / エディタを開き直す。

**確認方法：**  
Cursorの「ターミナル」を開き、次の文字を入力して Enter：

```bash
git --version
```

`git version 2.x.x` のように出ればOKです。

---

## ステップ2：GitHubで「リポジトリ」を1つ作る

**リポジトリ** = プロジェクトのコードを入れておく「フォルダ」のようなもの（オンライン上）。

1. **https://github.com** にログイン。
2. 右上の **「+」** → **「New repository」** をクリック。
3. 次のように入力：
   - **Repository name:** プロジェクト名（例：`wordig`）。半角英数字とハイフンだけ。
   - **Description:** 任意（例：「わたしのWebサイト」）。
   - **Public** を選択。
   - **「Add a README file」にはチェックを入れない**（手元に既にコードがあるため）。
4. **「Create repository」** をクリック。

作成後、**「…or push an existing repository from the command line」** という枠に、2行のコマンドが表示されます。このあと使うので、画面は開いたままにしておきます。

---

## ステップ3：自分のPCのプロジェクトをGitで「GitHub用」にする

ここからは **Cursor** で、**プロジェクトのフォルダ（例：wordig）を開いた状態**で進めます。

1. Cursorで **ターミナル** を開く  
   （メニュー：**ターミナル → 新しいターミナル**、または `` Ctrl+` ``）。
2. ターミナルで、**プロジェクトのフォルダにいるか**確認します。  
   今いる場所がプロジェクト名（例：`wordig`）でない場合は、次のように移動します（フォルダ名は自分の環境に合わせて変えてください）：

   ```bash
   cd C:\Users\ichioka mizuki\wordig
   ```

3. 次のコマンドを **1行ずつ** 順番に実行します。

   ```bash
   git init
   ```
   → 「初期化しました」という意味。このフォルダがGitの管理対象になります。

   ```bash
   git add .
   ```
   → 今あるファイルを全部「次の保存対象」にします。

   ```bash
   git commit -m "初回：サイトをGitHubに上げる"
   ```
   → いまの状態を「1つの保存ポイント」として記録します。

4. GitHubのリポジトリと「同じもの」だと教えます。  
   **YOUR_USERNAME** と **YOUR_REPO** は、GitHubで作った「ユーザー名」と「リポジトリ名」に置き換えてください。

   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   ```

   例：ユーザー名が `mizuki`、リポジトリ名が `wordig` なら  
   `https://github.com/mizuki/wordig.git`

5. ブランチ名を `main` にして、GitHubに送ります。

   ```bash
   git branch -M main
   git push -u origin main
   ```

   **初回の `git push` だけ**、GitHubの「ユーザー名」と「パスワード」を聞かれることがあります。  
   パスワードの代わりに **Personal Access Token** を使う必要がある場合があります（下の「よくあるつまずき」参照）。

ここまでできたら、GitHubのリポジトリのページを更新すると、ファイル一覧が表示されます。**パート1は完了です。**

---

# パート2：Vercelでサイトを公開する

## ステップ4：VercelにGitHubを連携する

1. **https://vercel.com** にアクセス。
2. **「Sign Up」** または **「Log In」** のところで **「Continue with GitHub」** を選ぶ。
3. GitHubの許可画面で **「Authorize Vercel」** などをクリックして許可する。

これで「VercelがGitHubの中身を見て、サイトを公開してよい」状態になります。

---

## ステップ5：Vercelで「新しいプロジェクト」を作る

1. Vercelのダッシュボードで **「Add New…」** → **「Project」** をクリック。
2. **「Import Git Repository」** の一覧に、GitHubのリポジトリが出ます。  
   さきほど作ったリポジトリ（例：wordig）を選び、**「Import」** をクリック。
3. **Configure Project** の画面では：
   - **Framework Preset:** 多くの場合は自動で「Vite」などが選ばれています。そのままでOK。
   - **Root Directory:** そのまま（空欄でOK）。
   - **Build and Output Settings:** そのまま（プロジェクトに `vercel.json` があれば、Vercelが読んでくれます）。
4. **「Deploy」** をクリック。

しばらくすると、ビルド（サイトの組み立て）が始まります。1〜2分待ちます。

---

## ステップ6：公開URLを確認する

1. デプロイが終わると **「Congratulations」** のような画面になります。
2. **「Visit」** や、表示されている **URL**（例：`https://wordig-xxxx.vercel.app`）をクリックすると、**あなたのサイトが世界中に公開された状態**で開きます。

このURLを誰かに教えれば、同じサイトを見てもらえます。**ここまででデプロイ完了です。**

---

# パート3：あとから更新するとき（2回目以降）

コードを直したあと、また公開し直す手順です。

1. Cursorでファイルを編集して保存する。
2. ターミナルで、プロジェクトのフォルダにいることを確認する。
3. 次の3行を実行する：

   ```bash
   git add .
   git commit -m "〇〇を変更した"
   git push
   ```

4. Vercelは **GitHubに push されたら自動で再デプロイ** します。  
   1〜2分後、同じURLで新しい内容が反映されています。

**「何を変更したか」** は `git commit -m "ここに書く"` の部分に短く書いておくと、あとで分かりやすいです。

---

# よくあるつまずき

### 1. `git push` で「パスワードが違う」と言われる

GitHubは、通常のログイン用パスワードではなく **Personal Access Token（PAT）** を求めている場合があります。

- GitHub → 右上のアイコン → **Settings** → 左の **Developer settings** → **Personal access tokens** → **Tokens (classic)**  
- **Generate new token (classic)** で、名前をつけて「repo」にチェックを入れて発行。
- 表示されたトークン（英数字の列）を **コピー** して、`git push` でパスワードを聞かれたら、**そのトークンを貼り付けて** Enter。

※ トークンは再表示できないので、メモしておくか、パスワード管理ツールに保存しておくと安心です。

---

### 2. Vercelのビルドが「失敗」になる

- **Vercelのデプロイ画面** で **「Building」** のログを開き、**赤いエラー文** を確認する。
- 「`npm install` に失敗」「Nodeのバージョンが合わない」などの場合：
  - プロジェクトに **`.nvmrc`** や **`engines`**（package.json内）でNodeのバージョンが書いてあれば、Vercelはそれを読んでくれます。  
    例：`"node": "24.x"` など。
- それでも失敗する場合は、エラー文をコピーして、周りのエンジニアや検索で「Vercel ビルド 失敗 〇〇」と調べると原因に近づけます。

---

### 3. 変更したのにサイトが更新されない

- `git push` までちゃんと実行したか確認する。
- Vercelのダッシュボードで、**最新のデプロイ**が「Ready」になっているか確認する。
- ブラウザの **キャッシュ** のせいで古いページが見えていることがあるので、**シフトキーを押しながら更新**（スーパーリロード）してみる。

---

### 4. リポジトリ名やURLを変えたい

- GitHubでリポジトリ名を変えた場合は、手元の「リモート」のURLを次のように更新します（YOUR_USERNAME / NEW_REPO を実際の値に変更）：

  ```bash
  git remote set-url origin https://github.com/YOUR_USERNAME/NEW_REPO.git
  ```

- Vercelのプロジェクト設定から、**Git のリポジトリ** を付け替えることもできます。

---

# まとめ：やること一覧

| 順番 | やること |
|------|----------|
| 1 | Gitをインストール（まだなら） |
| 2 | GitHubでリポジトリを1つ作る（READMEは追加しない） |
| 3 | 手元で `git init` → `git add .` → `git commit` → `git remote add origin` → `git push` |
| 4 | VercelにGitHubでログインし、そのリポジトリをImport → Deploy |
| 5 | 表示されたURLでサイトを確認 |
| 6 | 以降は「編集 → `git add .` → `git commit -m "説明"` → `git push`」で自動で再公開 |

エンジニアでなくても、この流れをそのまま踏めばデプロイまで到達できます。  
分からないステップがあれば、その番号と画面の様子をメモして誰かに聞くと、案内しやすいです。
