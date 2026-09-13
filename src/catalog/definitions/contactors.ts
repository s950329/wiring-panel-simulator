import type {CatalogTerminalDefinition, ComponentDefinition} from '../../core/contracts.ts';
import {poleBankTerminals, terminal} from './shared.ts';

const sp16Terminals: CatalogTerminalDefinition[] = [
  terminal('1L1', [-22, 70, -46], 'power', undefined, 'main'),
  terminal('3L2', [0, 70, -46], 'power', undefined, 'main'),
  terminal('5L3', [22, 70, -46], 'power', undefined, 'main'),
  terminal('2T1', [-22, 70, 46], 'power', undefined, 'main'),
  terminal('4T2', [0, 70, 46], 'power', undefined, 'main'),
  terminal('6T3', [22, 70, 46], 'power', undefined, 'main'),
  terminal('L-B-U', [-47, 80, -40], 'contact', 'å·¦å¾Œä¸Š', 'side'),
  terminal('L-B-L', [-47, 47, -40], 'contact', 'å·¦å¾Œä¸‹', 'side'),
  terminal('L-F-U', [-47, 80, 40], 'contact', 'å·¦å‰ä¸Š', 'side'),
  terminal('L-F-L', [-47, 47, 40], 'contact', 'å·¦å‰ä¸‹', 'side'),
  terminal('R-B-U', [47, 80, -40], 'contact', 'å³å¾Œä¸Š', 'side'),
  terminal('R-B-L', [47, 47, -40], 'contact', 'å³å¾Œä¸‹', 'side'),
  terminal('R-F-U', [47, 80, 40], 'contact', 'å³å‰ä¸Š', 'side'),
  terminal('R-F-L', [47, 47, 40], 'contact', 'å³å‰ä¸‹', 'side'),
  terminal('A1', [22, 20, -61], 'coil', 'A1', 'rear-lower'),
  terminal('A2', [0, 20, -61], 'coil', 'A2', 'rear-lower'),
];

const ap22Terminals: CatalogTerminalDefinition[] = [
  terminal('53', [-27, 35, -29], 'contact'),
  terminal('61', [-9, 35, -29], 'contact'),
  terminal('71', [9, 35, -29], 'contact'),
  terminal('83', [27, 35, -29], 'contact'),
  terminal('54', [-27, 35, 29], 'contact'),
  terminal('62', [-9, 35, 29], 'contact'),
  terminal('72', [9, 35, 29], 'contact'),
  terminal('84', [27, 35, 29], 'contact'),
];

const sc21lTerminals: CatalogTerminalDefinition[] = [
  ...poleBankTerminals(['R/1', 'S/3', 'T/5'], 62, 60, -41),
  ...poleBankTerminals(['U/2', 'V/4', 'W/6'], 62, 60, 41),
  terminal('A1', [-39, 93, -27], 'coil'),
  terminal('13', [39, 93, -27], 'contact'),
  terminal('A2', [-39, 93, 27], 'coil'),
  terminal('14', [39, 93, 27], 'contact'),
];

const cn18Terminals: CatalogTerminalDefinition[] = [
  ...poleBankTerminals(['1L1', '3L2', '5L3'], 62, 50, -43),
  ...poleBankTerminals(['2T1', '4T2', '6T3'], 62, 50, 43),
  terminal('21NC', [46, 91, -22], 'contact'),
  terminal('22NC', [46, 91, 22], 'contact'),
  terminal('A1', [-35, 30, -45], 'coil'),
  terminal('A2', [35, 30, 45], 'coil'),
];

export const contactorDefinitions = {
  'shihlin-sp16': {
    id: 'shihlin-sp16',
    category: 'contactor',
    visual: {model: 'contactorSP'},
    behavior: 'contactor',
    manufacturer: 'SHIHLIN',
    name: 'é›»ç£æ¥è§¸åj	Ëˆ[Ù[ˆ	ÔÒRSˆËTM‰ËˆİÎˆ	ÒSQ×ÌL	ËˆÚ^™NˆÌLMKLM×Kˆ\›Z[˜[ÎˆÜM•\›Z[˜[Ëˆ[XİšXØ[ˆÂˆÛÚ[ˆİ\›Z[˜[ÎˆÉĞLIË	ĞL‰×_KˆÛÛXİÎˆÂˆİ\Nˆ	Ó“ÉË\›Z[˜[ÎˆÉÌSIË	Ì•I×KÛÛ›ÛYNˆ	ØÛÚ[	ßKˆİ\Nˆ	Ó“ÉË\›Z[˜[ÎˆÉÌÓ‰Ë	Í‰×KÛÛ›ÛYNˆ	ØÛÚ[	ßKˆİ\Nˆ	Ó“ÉË\›Z[˜[ÎˆÉÍSÉË	Í•É×KÛÛ›ÛYNˆ	ØÛÚ[	ßKˆKˆKˆ[ˆ	ù£"y/cùcëùbåy.í¹é.¹ëá9ªgù¨¬9häùd";ï#9¥/ºe¢ùclùoªy/cxà ¹§+:jå9alHMˆ9`"ù£©yíæºnç»ï&¹aky`"ù..ùêëùkd8à yajù`"ù`m9ïï9êëùkd;ï#9.éycâ¹o£9`m9."ù£¤ˆL{ï#ĞL¸à ¹/cyïk¹ª&yìi:(j9é.¹mé»ï#ùcìøà ybc{ï#ùo£8à y."»ï#ù."ûï#9ké¹âjyêëùkd:&gùo¡yè®º*£xà ¹."ù¥®H{ï#Õ»ï#ÕÈ9cëú`n9cåˆH9§éyç"øà ‰ËˆKˆ	ÜÚZ[‹X\Œ‰ÎˆÂˆYˆ	ÜÚZ[‹X\Œ‰ËˆØ]YÛÜNˆ	Ø]^[X\PÛÛXİ	Ëˆš\İX[ˆÛ[Ù[ˆ	Ø]^[X\IßKˆ™Z]š[Üˆ	Ø]^[X\IËˆX[Y˜Xİ\™\ˆ	ÔÒRS‰Ëˆ˜[YNˆ	ú/%9bªy£©znç¹ía	Ëˆ[Ù[ˆ	ÔÒRSˆTLŒˆ0­È““È
È“ÉËˆİÎˆ	ÒSQ×ÌÉËˆÚ^™NˆÍÎKÌKˆ\›Z[˜[Îˆ\Œ•\›Z[˜[Ëˆ[XİšXØ[ˆÂˆÛÛXİÎˆÂˆİ\Nˆ	Ó“ÉË\›Z[˜[ÎˆÉÍLÉË	ÍM	×_Kˆİ\Nˆ	ÓÉË\›Z[˜[ÎˆÉÍŒIË	ÍŒ‰×_Kˆİ\Nˆ	ÓÉË\›Z[˜[ÎˆÉÍÌIË	ÍÌ‰×_Kˆİ\Nˆ	Ó“ÉË\›Z[˜[ÎˆÉÎÉË	Î	×_KˆKˆKˆ[ˆ	ùãj9êâùk¢z(çy¥¯ËTMˆ9."¹¥®yæ¡““È
È“È:/%9bªy£©znç»ï&úfª9£©z)î9fj9ªgù¨¬9båy/g: kùbåxà ‰ËˆKˆ	ÜÚZ[‹\ØÌŒ[	ÎˆÂˆYˆ	ÜÚZ[‹\ØÌŒ[	ËˆØ]YÛÜNˆ	ØÛÛXİÜ‰Ëˆš\İX[ˆÛ[Ù[ˆ	ØÛÛXİÜ”ĞÉßKˆ™Z]š[Üˆ	ØÛÛXİÜ‰ËˆX[Y˜Xİ\™\ˆ	ÔÒRS‰Ëˆ˜[YNˆ	úfîùèày£©z)î9fj	Ëˆ[Ù[ˆ	ÔÒRSˆËPÌŒS;ï"9g¢ú&gùo¡y¨.;ï"IËˆİÎˆ	ÒSQ×ÌÉËˆÚ^™NˆÎ‹L‹LL×Kˆ\›Z[˜[ÎˆØÌŒ[\›Z[˜[Ëˆ[XİšXØ[ˆÂˆÛÚ[ˆİ\›Z[˜[ÎˆÉĞLIË	ĞL‰×_KˆÛÛXİÎˆÂˆİ\Nˆ	Ó“ÉË\›Z[˜[ÎˆÉÔ‹ÌIË	ÕKÌ‰×KÛÛ›ÛYNˆ	ØÛÚ[	ßKˆİ\Nˆ	Ó“ÉË\›Z[˜[ÎˆÉÔËÌÉË	Õ‹Í	×KÛÛ›ÛYNˆ	ØÛÚ[	ßKˆİ\Nˆ	Ó“ÉË\›Z[˜[ÎˆÉÕÍIË	ÕËÍ‰×KÛÛ›ÛYNˆ	ØÛÚ[	ßKˆİ\Nˆ	Ó“ÉË\›Z[˜[ÎˆÉÌLÉË	ÌM	×KÛÛ›ÛYNˆ	ØÛÚ[	ßKˆKˆKˆ[ˆ	ù£"y/cúb¦9âc9.+yi+ºnäz"l¹cëùbåy.í»ï#9¥/ºe¢ùclùoªy/cxà ¹«i9båy/g9.#y.èú(j9íæ¹g":`&ºfîøà ‰ËˆKˆ	ØÛŒN	ÎˆÂˆYˆ	ØÛŒN	ËˆØ]YÛÜNˆ	ØÛÛXİÜ‰Ëˆš\İX[ˆÛ[Ù[ˆ	ØÛÛXİÜÓ‰ßKˆ™Z]š[Üˆ	ØÛÛXİÜ‰Ëˆ˜[YNˆ	úfîùèày£©z)î9fj	Ëˆ[Ù[ˆ	ĞÓ‹LN	ËˆİÎˆ	ÒSQ×ÌL	ËˆÚ^™NˆÎL‹LWKˆ\›Z[˜[ÎˆÛŒN\›Z[˜[Ëˆ[XİšXØ[ˆÂˆÛÚ[ˆİ\›Z[˜[ÎˆÉĞLIË	ĞL‰×_KˆÛÛXİÎˆÂˆİ\Nˆ	Ó“ÉË\›Z[˜[ÎˆÉÌSIË	Ì•I×KÛÛ›ÛYNˆ	ØÛÚ[	ßKˆİ\Nˆ	Ó“ÉË\›Z[˜[ÎˆÉÌÓ‰Ë	Í‰×KÛÛ›ÛYNˆ	ØÛÚ[	ßKˆİ\Nˆ	Ó“ÉË\›Z[˜[ÎˆÉÍSÉË	Í•É×KÛÛ›ÛYNˆ	ØÛÚ[	ßKˆİ\Nˆ	ÓÉË\›Z[˜[ÎˆÉÌŒSÉË	ÌŒ“É×KÛÛ›ÛYNˆ	ØÛÚ[	ßKˆKˆKˆ[ˆ	ù£"y/cùàl:"l¹¨a¹aiùæ¡:näz"l¹ªgù©âûï#9¥/ºe¢ùclùoªy/cxà ‰ËˆKŸHØ]\ÙšY\È™XÛÜ™İš[™ËÛÛ\Û™[Yš[š][ÛÂ