## mixed_network / TCP/IP
- 1. TCPはコネクションレス型のプロトコルである -> incorrect
- 2. 3ウェイハンドシェイクで接続を確立する -> correct
- 3. HTTPのデフォルトポートは80番 -> correct
- 4. UDPは再送制御を行わないためリアルタイム通信に向いている -> correct

## mostly_correct_python / Pythonの実行方式
- 1. Pythonは通常インタプリタで実行され -> correct
- 2. ソースコードは一度バイトコードに変換される -> correct

## no_claims / ネットワーク
- claimsなし

## python_data_types_custom / Pythonのデータ型
- 1. Pythonのリストはミュータブル（変更可能）である -> correct
- 2. タプルはイミュータブル（変更不可）である -> correct
- 3. 辞書はキーと値のペアを持つ -> correct
- 4. キーにはイミュータブルな型しか使えない -> correct
- 5. setは重複を許さないコレクションである -> correct
- 6. setは順序を保持しない -> correct

## git_basics_custom / Gitの基本操作
- 1. git addでステージングエリアに追加する -> correct
- 2. git commitで変更を確定する -> correct
- 3. git pullはリモートの変更を fetchしてmergeする操作である。 -> correct
- 4. git rebaseはコミット履歴を一直線にできる -> correct
- 5. git rebaseは使うと危険なので本番では使わない方がいい。 -> incorrect
- 6. git stashは変更を一時的に退避させる。 -> correct
- 7. stashした内容はブランチを切り替えても消えない。 -> correct
- 8. conflictが起きたらgit merge --abortで必ず解消できる。 -> incorrect

## process_thread_custom / プロセスとスレッド
- 1. プロセスはOSが管理するプログラムの実行単位で、それぞれ独立したメモリ空間を持つ。 -> correct
- 2. スレッドはプロセス内の実行単位で、同じプロセスのスレッド同士はメモリを共有する。 -> correct
- 3. マルチスレッドではデッドロックが起きることがある。 -> correct
- 4. デッドロックはスレッド同士がリソースを待ち合う状態。 -> correct
- 5. コンテキストスイッチはCPUが別のプロセスに切り替える処理で、オーバーヘッドがある。 -> correct

## http_methods_custom / HTTPメソッド
- 1. GETはデータの送信に使い、リクエストボディにデータを含める。 -> incorrect
- 2. POSTはデータの取得に使い、キャッシュが効く。 -> incorrect
- 3. PUTはリソースの部分更新に使う。 -> incorrect
- 4. DELETEはリソースの削除に使い、冪等性がある。 -> correct
- 5. PATCHはリソースの全体置換に使う。 -> incorrect
- 6. HEADはレスポンスボディ付きでヘッダー情報を返すメソッドである。 -> incorrect

## react_intro_custom / React入門
- 1. JSXはHTMLっぽく書ける -> correct
- 2. useStateフックで状態管理ができる -> correct
- 3. 状態が変わるとコンポーネントが再レンダリングされる -> correct
- 4. propsは親コンポーネントから子コンポーネントにデータを渡す仕組み -> correct

## javascript_no_claims_custom / JavaScript
- claimsなし

## calculus_basic_custom / 微分の基礎
- 1. 微分とは関数の瞬間的な変化率を求める操作である。 -> correct
- 2. f(x) = x^2 の導関数は f'(x) = 2x である。 -> correct
- 3. 微分と積分は逆の操作であり、これを微分積分学の基本定理という。 -> correct
- 4. f(x) = sin(x) の導関数は f'(x) = -cos(x) である。 -> incorrect
- 5. 導関数が0になる点は極値の候補である。 -> correct

## statistics_custom / 確率・統計
- 1. 標準偏差は分散の平方根である。 -> correct
- 2. 正規分布では平均±1σの範囲にデータの約68%が含まれる。 -> correct
- 3. 平均±2σには約99.7%が含まれる。 -> incorrect
- 4. 中央値は外れ値の影響を受けにくい代表値である。 -> correct
- 5. 相関係数は-1から1の値をとり、0に近いほど相関がない。 -> correct
- 6. 相関があれば因果関係がある。 -> incorrect

## mechanics_basic_custom / 力学の基礎
- 1. ニュートンの第一法則は慣性の法則で、外力が働かなければ物体は等速直線運動を続ける。 -> correct
- 2. F = ma はニュートンの第三法則である。 -> incorrect
- 3. 重力加速度は地球上で約9.8 m/s^2。 -> correct
- 4. 運動エネルギーは 1/2 mv^2 で表される。 -> correct
- 5. 仕事の単位はジュール(J)で、1J = 1kg・m^2/s^2 である。 -> correct
- 6. 作用反作用の法則では、2つの力は同じ物体に働く。 -> incorrect

## elements_periodic_table_custom / 元素と周期表
- 1. 水素の原子番号は1で、元素記号はH。 -> correct
- 2. 周期表は元素を原子番号順に並べたものである。 -> correct
- 3. 周期表はメンデレーエフが最初に提唱した。 -> correct
- 4. 同じ族の元素は化学的性質が似ている。 -> correct
- 5. 希ガスは最外殻電子が安定しているため反応性が極めて低い。 -> correct
- 6. 鉄の元素記号はFaである。 -> incorrect
- 7. 水の分子式はH2Oで、共有結合でできている。 -> correct

## cell_biology_basic_custom / 細胞の基礎
- 1. 細胞にはDNAを含む核がある。 -> correct
- 2. 赤血球は例外で核を持たない。 -> correct
- 3. ミトコンドリアはATPを生成する。 -> correct
- 4. ミトコンドリアは独自のDNAを持つ。 -> correct
- 5. 光合成は葉緑体で行われる。 -> correct
- 6. 光合成は二酸化炭素と水から酸素とグルコースを生成する。 -> correct
- 7. リボソームはタンパク質を合成する場所である。 -> correct
- 8. 細胞膜はリン脂質の単層構造でできている。 -> incorrect

## meiji_restoration_custom / 明治維新
- 1. 明治維新は1868年に始まった。 -> correct
- 2. 大政奉還により徳川慶喜が天皇に政権を返上した。 -> correct
- 3. 廃藩置県により藩が廃止され、中央集権国家への移行が進んだ。 -> correct
- 4. 明治政府は富国強兵をスローガンに殖産興業政策を進めた。 -> correct
- 5. 西南戦争は西郷隆盛が明治政府に対して起こした反乱で、1877年に起きた。 -> correct
- 6. 大日本帝国憲法は1889年に公布され、伊藤博文が中心となって起草した。 -> correct
- 7. 明治維新の三傑は西郷隆盛、木戸孝允、坂本龍馬である。 -> incorrect

## french_revolution_custom / フランス革命
- 1. フランス革命は1789年にバスティーユ牢獄の襲撃で始まった。 -> correct
- 2. 革命のスローガンは「自由・平等・博愛」である。 -> correct
- 3. 国王ルイ16世と王妃マリー・アントワネットは革命中にギロチンで処刑された。 -> correct
- 4. 革命後にナポレオンが皇帝に即位したのは1789年である。 -> incorrect
- 5. 人権宣言では人間の自由と平等が謳われた。 -> correct
- 6. ロベスピエールは恐怖政治を行い、最終的に自分もギロチンで処刑された。 -> correct

## world_geography_custom / 世界の地理
- 1. 世界で一番面積が大きい国はロシアである -> correct
- 2. 面積が2番目に大きい国はカナダである -> correct
- 3. 世界で一番人口が多い国は中国である -> incorrect
- 4. ナイル川は世界で最も長い川である -> correct
- 5. ナイル川はアフリカ大陸を流れている -> correct
- 6. エベレストは世界最高峰である -> correct
- 7. エベレストの標高は約8849mである -> correct
- 8. オーストラリアは世界最小の大陸である -> correct
- 9. オーストラリアは同時に一つの国でもある -> correct
- 10. サハラ砂漠は南アメリカにある -> incorrect
- 11. サハラ砂漠は世界最大の砂漠である -> ambiguous

## japanese_law_basic_custom / 日本の法律の基礎
- 1. 日本国憲法は1947年に施行された。 -> correct
- 2. 憲法第9条は戦争の放棄と戦力の不保持を定めている。 -> correct
- 3. 刑法では18歳未満は死刑にならないと定められている。 -> incorrect
- 4. 民法の成年年齢は18歳である。 -> correct
- 5. 著作権は著作物を創作した時点で自動的に発生し、登録は不要である。 -> correct
- 6. 特許権も著作権と同様に自動的に発生する。 -> incorrect

## english_tenses_custom / 英語の時制（現在完了形）
- 1. 現在完了形は have + 過去分詞 で作る。 -> correct
- 2. 現在完了は過去の出来事が現在に影響を与えていることを表す。 -> correct
- 3. "I have been to Paris" は「パリに行ったことがある」という経験を表す。 -> correct
- 4. 過去形と現在完了形は同じ意味で、互換性がある。 -> incorrect
- 5. "since" は現在完了形と一緒に使い、起点を表す。 -> correct
- 6. "for" は期間を表し、過去形でも現在完了形でも使える。 -> correct

## nutrition_basic_custom / 栄養学の基礎
- 1. 三大栄養素は炭水化物、タンパク質、脂質である。 -> correct
- 2. ビタミンCは水溶性ビタミンで、過剰摂取分は尿として排出される。 -> correct
- 3. コラーゲンを食べると肌のコラーゲンが増える。 -> incorrect
- 4. 食物繊維は消化されないが、腸内環境を整える効果がある。 -> correct
- 5. 1日に必要な水分量は個人差があるが、一般的に約2リットルとされる。 -> correct
- 6. 卵は1日1個までにしないとコレステロールが上がる。 -> incorrect

## classical_japanese_verb_custom / 古典文法の動詞活用
- 1. 古典の動詞には九種類の活用がある。 -> correct
- 2. 四段活用は「書かず、書きて、書く、書くとき、書けども、書け」のように活用する。 -> correct
- 3. 上一段活用は「見ず、見て、見る、見るとき、見れども、見よ」で[ある]。 -> correct
- 4. 上一段活用は、語幹と語尾の区別がない。 -> correct
- 5. 下二段活用の例として「受く」がある。 -> correct
- 6. 下二段活用「受く」は「受けず、受けて、受く、受くるとき、受くれども、受けよ」と活用する。 -> correct
- 7. カ行変格活用は「来」だけ[である]。 -> correct
- 8. サ行変格活用は「す」「おはす」がある。 -> correct
- 9. ナ行変格活用は「死ぬ」「行く」の二語である。 -> incorrect

## classical_auxiliary_custom / 古典の助動詞
- 1. 助動詞「む」は推量・意志などの意味を持つ。 -> correct
- 2. 「き」は過去の助動詞で、直接体験した過去に用いる。 -> correct
- 3. 「けり」は過去の助動詞で、伝聞過去や詠嘆の意味がある。 -> correct
- 4. 打消の助動詞「ず」は未然形に接続する。 -> correct
- 5. 「べし」は終止形接続で、ラ変型活用語には連体形に接続する。 -> correct
- 6. 完了の助動詞「つ」「ぬ」は、ともに連用形接続である。 -> correct
- 7. 受身・尊敬・自発・可能を表す助動詞「る」「らる」は、すべて四段動詞の未然形に接続する。 -> incorrect

## classical_vocab_custom / 古文単語の頻出語
- 1. 「あはれ」はしみじみとした情趣を表す言葉。 -> correct
- 2. 「をかし」は趣がある・興味深いという意味で、清少納言の美的理念。 -> correct
- 3. 「ありがたし」は現代語と同じく「感謝すべき」という意味である。 -> incorrect
- 4. 「うつくし」は古文では「かわいらしい」という意味で、現代の「美しい」とは異なる。 -> correct
- 5. 「なつかし」は現代語と同じく「過去を懐かしむ」という意味で使う。 -> incorrect
- 6. 「つとめて」は「早朝」という意味である。 -> correct
- 7. 「かなし」は「悲しい」だけでなく「愛しい」という意味もある。 -> correct
