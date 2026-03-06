/**
 * 拼音 → 中文姓名推测（类似输入法）
 * 用于 Roster 中将拼音名字显示为推测的中文名
 */

// 姓：拼音 → 汉字
const SURNAME_MAP: Record<string, string> = {
  bai: "白", cai: "蔡", cao: "曹", chen: "陈", cheng: "程", chi: "迟", chu: "楚",
  dai: "戴", deng: "邓", ding: "丁", dong: "董", du: "杜", duan: "段", fan: "范",
  fang: "方", feng: "冯", fu: "傅", gao: "高", gong: "龚", gu: "顾", guo: "郭",
  han: "韩", he: "何", hong: "洪", hou: "侯", hu: "胡", huang: "黄", hui: "惠",
  jia: "贾", jiang: "江", jin: "金", kang: "康", kong: "孔", lei: "雷", li: "李",
  liang: "梁", liao: "廖", lin: "林", liu: "刘", long: "龙", lu: "陆", luo: "罗",
  ma: "马", mao: "毛", meng: "孟", pan: "潘", peng: "彭", qian: "钱", qin: "秦",
  ren: "任", song: "宋", sun: "孙", tan: "谭", tang: "唐", tao: "陶", tian: "田",
  wan: "万", wang: "王", wei: "魏", wen: "温", wu: "吴", xi: "席", xia: "夏",
  xiao: "萧", xie: "谢", xin: "辛", xu: "徐", xue: "薛", yan: "严", yang: "杨",
  yao: "姚", ye: "叶", yi: "易", yin: "尹", yu: "于", yuan: "袁", zeng: "曾",
  zha: "查", zhang: "张", zhao: "赵", zheng: "郑", zhong: "钟", zhou: "周",
  zhu: "朱", zhuang: "庄", zou: "邹",
};

// 名（名字用字）：拼音 → 汉字
const GIVEN_NAME_MAP: Record<string, string> = {
  ai: "爱", an: "安", bin: "斌", bo: "博", cai: "才", chang: "昌", chao: "超",
  chen: "晨", chun: "春", dan: "丹", fei: "飞", feng: "峰", gang: "刚", guang: "光",
  hai: "海", han: "涵", hao: "浩", hua: "华", hui: "慧", jia: "佳", jian: "建",
  jie: "杰", jing: "静", jun: "俊", kang: "康", kun: "坤", lan: "兰", lei: "磊",
  li: "丽", liang: "亮", ling: "玲", long: "龙", mei: "梅", min: "敏", ming: "明",
  nan: "楠", ning: "宁", peng: "鹏", ping: "平", qi: "琪", qiang: "强", qin: "琴",
  qing: "清", ran: "然", rong: "荣", rui: "瑞", san: "三", shu: "淑", shuang: "双",
  song: "松", tao: "涛", ting: "婷", wei: "伟", xi: "希", xian: "贤", xiang: "祥",
  xiao: "晓", xin: "欣", xue: "雪", xuan: "轩", yan: "艳", yang: "阳", ye: "烨",
  yi: "怡", ying: "英", yong: "勇", yu: "宇", yue: "月", yun: "云", ze: "泽",
  zhen: "珍", zhi: "志", zhong: "中", si: "思",
};

// 用于分词的拼音音节表（按长度降序，优先匹配长音节如 zhuang, zhang）
const SYLLABLES = (
  "zhuang zheng zhong zhao zhan zhang zhua zhui zhun zhuo " +
  "chuang cheng chong chou chuan chui chun chuo shuang sheng shou shuan shui shun shuo " +
  "bang beng bian biao bing cang ceng chai chan chang chao che chen chi chua chuai " +
  "cong cui dang deng dian diao ding dong dou duan dun duo fang fei fen feng fou " +
  "gang geng gong gou gua guai guan guang gui gun guo hang heng hong hou hua huai " +
  "huan huang hui hun huo jiang jiao jie jin jing jiong jiu juan jue jun kang keng " +
  "kong kou kua kuai kuan kuang kui kun kuo lang leng liang liao lie lin ling liu " +
  "long lou luan lue lun mang meng mian miao mie min ming miu mou nang neng niang " +
  "niao nie nin ning nong nuan nue nuo pang peng pian piao pie pin ping pou " +
  "qiang qiao qie qin qing qiong qiu quan que qun rang reng rong rou ruan rui " +
  "run ruo sang seng shai shan shang shao she shen shi shua shuai shu " +
  "tang teng tian tiao tie ting tong tou tuan tui tun tuo wang wei wen weng " +
  "xian xiang xiao xie xin xing xiong xiu xuan xue xun yang yao ye yin ying " +
  "yong you yuan yue yun zang zao zei zen zeng zhai zhe zhen zhi " +
  "bai ban bao bei ben bi bian biao bie bin bo bu ca cai can cao ce cen " +
  "cha che ci cou cu da dai dan dao de di diao die diu du e ei en er " +
  "fa fan fei fo fu ga gai gan gao ge gei gen gong gu gua gui gun " +
  "ha hai han hao he hei hen hong hu hua hui huo ji jia jian jiang jiao " +
  "jie jin jiu ju juan jue ka kai kan kang kao ke ken kong ku kua kui " +
  "kuo la lai lan lao le lei leng li lia lian lie lin liu long lu lv " +
  "ma mai man mao me mei men mi mian miao min mo mu na nai nan nao ne " +
  "nei ni nian niao nie niu nong nu nv nuo ou pa pai pan pao pei pen " +
  "pi pian piao pin po pu qi qia qian qie qiu qu que ran rang rao re ren " +
  "ri rong rou ru rui sa sai san sao se sen sha shai shao she shei shi " +
  "shu shua shuo si song sou su sui sun suo ta tai tan tao te ti " +
  "tian tong tu tui tun wa wai wan wo wu xi xia xiu xu xue ya yan " +
  "yao ye yi yo yu za zai zan zao ze zen zi zong zou zu zuo"
).split(/\s+/).filter(Boolean);

// 按长度降序，便于最长匹配
const SYLLABLES_SORTED = [...SYLLABLES].sort((a, b) => b.length - a.length);

const HAS_CJK = /\p{Script=Han}/u;

/** 判断字符串是否已包含中文 */
function hasChinese(s: string): boolean {
  return HAS_CJK.test(s);
}

/** 将连续拼音串切分为音节（如 zhangsan -> [zhang, san]） */
function segmentPinyin(text: string): string[] {
  const lower = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!lower) return [];
  const parts: string[] = [];
  let i = 0;
  while (i < lower.length) {
    if (lower[i] === " ") {
      i++;
      continue;
    }
    let found = false;
    for (const syl of SYLLABLES_SORTED) {
      if (lower.slice(i, i + syl.length) === syl) {
        parts.push(syl);
        i += syl.length;
        found = true;
        break;
      }
    }
    if (!found) {
      // 无法识别的片段：吞掉直到下一个空格或下一个可匹配音节
      let end = i + 1;
      while (end < lower.length && lower[end] !== " ") {
        const rest = lower.slice(end);
        const anyMatch = SYLLABLES_SORTED.some((s) => rest.startsWith(s));
        if (anyMatch) break;
        end++;
      }
      parts.push(lower.slice(i, end));
      i = end;
    }
  }
  return parts;
}

/**
 * 将「纯拼音」名字推测为中文（类似输入法）。
 * 若输入已含中文则原样返回；否则按音节分词后查表转成汉字。
 */
export function pinyinToName(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return s;
  if (hasChinese(s)) return s;

  const segments: string[] = [];
  for (const token of s.split(/\s+/)) {
    segments.push(...segmentPinyin(token));
  }

  if (segments.length === 0) return s;
  const chars = segments.map((syl, i) => {
    if (i === 0) return SURNAME_MAP[syl] ?? GIVEN_NAME_MAP[syl] ?? syl;
    return GIVEN_NAME_MAP[syl] ?? SURNAME_MAP[syl] ?? syl;
  });
  const result = chars.join("");
  return result !== s ? result : s;
}
