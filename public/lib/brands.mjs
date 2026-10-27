// The banks, stored-value cards and e-payments of Taiwan an account can be,
// each with its logo (img/brand/<id>.png, from its own site: scripts/brand-logos.mjs)
// and colour. code: the bank's 銀行代碼.
import { LOGOS } from './logos.mjs';

export const BRANDS = [
  // Stored-value cards (電子票證).
  { id: 'easycard', kind: 'ticket', zh: '悠遊卡', en: 'EasyCard', color: '#0a7cc1', site: 'https://www.easycard.com.tw/' },
  { id: 'ipass', kind: 'ticket', zh: '一卡通', en: 'iPASS', color: '#e4007f', site: 'https://www.i-pass.com.tw/' },
  { id: 'icash', kind: 'ticket', zh: 'icash', en: 'icash', color: '#e60012', site: 'https://www.icash.com.tw/' },
  { id: 'happycash', kind: 'ticket', zh: '有錢卡', en: 'HappyCash', color: '#f39800', site: 'https://www.happycash.com.tw/' },
  // E-payments (電子支付).
  { id: 'linepay', kind: 'wallet', zh: 'LINE Pay', en: 'LINE Pay', color: '#06c755', site: 'https://pay.line.me/portal/tw/main' },
  { id: 'jkopay', kind: 'wallet', zh: '街口支付', en: 'JKOPAY', color: '#e60033', site: 'https://www.jkopay.com/' },
  { id: 'pxpay', kind: 'wallet', zh: '全支付', en: 'PX Pay Plus', color: '#e60012', site: 'https://www.pxpayplus.com/' },
  { id: 'easywallet', kind: 'wallet', zh: '悠遊付', en: 'Easy Wallet', color: '#0a7cc1', site: 'https://easywallet.easycard.com.tw/' },
  { id: 'icashpay', kind: 'wallet', zh: 'icash Pay', en: 'icash Pay', color: '#e60012', site: 'https://www.icashpay.com.tw/' },
  { id: 'pipay', kind: 'wallet', zh: 'Pi 拍錢包', en: 'Pi Wallet', color: '#ff5a00', site: 'https://www.piapp.com.tw/' },
  { id: 'taiwanpay', kind: 'wallet', zh: '台灣 Pay', en: 'Taiwan Pay', color: '#00a0e9', site: 'https://www.taiwanpay.com.tw/' },
  // Banks (and 中華郵政).
  { id: 'post', kind: 'bank', code: '700', zh: '中華郵政', en: 'Chunghwa Post', color: '#00863d', site: 'https://www.post.gov.tw/' },
  { id: 'bot', kind: 'bank', code: '004', zh: '臺灣銀行', en: 'Bank of Taiwan', color: '#00693e', site: 'https://www.bot.com.tw/' },
  { id: 'landbank', kind: 'bank', code: '005', zh: '土地銀行', en: 'Land Bank', color: '#00843d', site: 'https://www.landbank.com.tw/' },
  { id: 'tcb', kind: 'bank', code: '006', zh: '合作金庫', en: 'TCB Bank', color: '#007f45', site: 'https://www.tcb-bank.com.tw/' },
  { id: 'firstbank', kind: 'bank', code: '007', zh: '第一銀行', en: 'First Bank', color: '#004f9f', site: 'https://www.firstbank.com.tw/' },
  { id: 'hncb', kind: 'bank', code: '008', zh: '華南銀行', en: 'Hua Nan Bank', color: '#c8102e', site: 'https://www.hncb.com.tw/' },
  { id: 'chb', kind: 'bank', code: '009', zh: '彰化銀行', en: 'Chang Hwa Bank', color: '#d0021b', site: 'https://www.bankchb.com/' },
  { id: 'scsb', kind: 'bank', code: '011', zh: '上海商銀', en: 'SCSB', color: '#a6192e', site: 'https://www.scsb.com.tw/' },
  { id: 'fubon', kind: 'bank', code: '012', zh: '台北富邦', en: 'Taipei Fubon', color: '#00857c', site: 'https://www.fubon.com/banking/' },
  { id: 'cathay', kind: 'bank', code: '013', zh: '國泰世華', en: 'Cathay United', color: '#00a651', site: 'https://www.cathaybk.com.tw/cathaybk/' },
  { id: 'mega', kind: 'bank', code: '017', zh: '兆豐銀行', en: 'Mega Bank', color: '#c4122f', site: 'https://www.megabank.com.tw/' },
  { id: 'obank', kind: 'bank', code: '048', zh: '王道銀行', en: 'O-Bank', color: '#ff6b00', site: 'https://www.o-bank.com/' },
  { id: 'tbb', kind: 'bank', code: '050', zh: '臺灣企銀', en: 'TBB', color: '#004098', site: 'https://www.tbb.com.tw/' },
  { id: 'sc', kind: 'bank', code: '052', zh: '渣打銀行', en: 'Standard Chartered', color: '#0473ea', site: 'https://www.sc.com/tw/' },
  { id: 'tcbbank', kind: 'bank', code: '053', zh: '台中銀行', en: 'Taichung Bank', color: '#e60012', site: 'https://www.tcbbank.com.tw/' },
  { id: 'ktb', kind: 'bank', code: '054', zh: '京城銀行', en: 'King’s Town Bank', color: '#c30d23', site: 'https://www.ktb.com.tw/' },
  { id: 'hsbc', kind: 'bank', code: '081', zh: '滙豐銀行', en: 'HSBC', color: '#db0011', site: 'https://www.hsbc.com.tw/' },
  { id: 'skbank', kind: 'bank', code: '103', zh: '新光銀行', en: 'Shin Kong Bank', color: '#e60012', site: 'https://www.skbank.com.tw/' },
  { id: 'sunny', kind: 'bank', code: '108', zh: '陽信銀行', en: 'Sunny Bank', color: '#f39800', site: 'https://www.sunnybank.com.tw/' },
  { id: 'ubot', kind: 'bank', code: '803', zh: '聯邦銀行', en: 'Union Bank', color: '#00479d', site: 'https://www.ubot.com.tw/' },
  { id: 'feib', kind: 'bank', code: '805', zh: '遠東商銀', en: 'Far Eastern Bank', color: '#e60012', site: 'https://www.feib.com.tw/' },
  { id: 'yuanta', kind: 'bank', code: '806', zh: '元大銀行', en: 'Yuanta Bank', color: '#0054a6', site: 'https://www.yuantabank.com.tw/' },
  { id: 'sinopac', kind: 'bank', code: '807', zh: '永豐銀行', en: 'Bank SinoPac', color: '#e60012', site: 'https://bank.sinopac.com/' },
  { id: 'esun', kind: 'bank', code: '808', zh: '玉山銀行', en: 'E.SUN Bank', color: '#00a19a', site: 'https://www.esunbank.com/' },
  { id: 'kgi', kind: 'bank', code: '809', zh: '凱基銀行', en: 'KGI Bank', color: '#ee7700', site: 'https://www.kgibank.com.tw/' },
  { id: 'dbs', kind: 'bank', code: '810', zh: '星展銀行', en: 'DBS Bank', color: '#ff3e3e', site: 'https://www.dbs.com.tw/' },
  { id: 'taishin', kind: 'bank', code: '812', zh: '台新銀行', en: 'Taishin Bank', color: '#d6001c', site: 'https://www.taishinbank.com.tw/' },
  { id: 'entie', kind: 'bank', code: '816', zh: '安泰銀行', en: 'EnTie Bank', color: '#00a0e9', site: 'https://www.entiebank.com.tw/' },
  { id: 'ctbc', kind: 'bank', code: '822', zh: '中國信託', en: 'CTBC Bank', color: '#008c95', site: 'https://www.ctbcbank.com/' },
  { id: 'nextbank', kind: 'bank', code: '823', zh: '將來銀行', en: 'NEXT Bank', color: '#5b2be0', site: 'https://www.nextbank.com.tw/' },
  { id: 'linebank', kind: 'bank', code: '824', zh: 'LINE Bank', en: 'LINE Bank', color: '#06c755', site: 'https://www.linebank.com.tw/' },
  { id: 'rakuten', kind: 'bank', code: '826', zh: '樂天銀行', en: 'Rakuten Bank', color: '#bf0000', site: 'https://www.rakuten-bank.com.tw/' }
];
const BY_ID = new Map(BRANDS.map(b => [b.id, b]));
export const brandOf = id => BY_ID.get(id) || null;
export const brandsFor = kind => BRANDS.filter(b => b.kind === (kind === 'credit' ? 'bank' : kind));
export const logoOf = id => (BY_ID.has(id) && LOGOS.has(id) ? `./img/brand/${id}.png` : '');
