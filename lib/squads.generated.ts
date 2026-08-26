// GENERATED FILE — run `npm run gen:squads` to regenerate. Do not hand-edit.
import type { Squad } from '@/types/squad';
import squadArg from '@/data/squads/nation/arg.json';
import squadArm from '@/data/squads/nation/arm.json';
import squadArs from '@/data/squads/club/premier-league/ars.json';
import squadBar from '@/data/squads/club/la-liga/bar.json';
import squadBra from '@/data/squads/nation/bra.json';
import squadEsp from '@/data/squads/nation/esp.json';
import squadFra from '@/data/squads/nation/fra.json';
import squadInt from '@/data/squads/club/serie-a/int.json';
import squadJpn from '@/data/squads/nation/jpn.json';
import squadPsg from '@/data/squads/club/ligue-1/psg.json';
import squadRma from '@/data/squads/club/la-liga/rma.json';

export const SQUAD_FILES: Record<string, Squad> = {
  arg: squadArg as Squad,
  arm: squadArm as Squad,
  ars: squadArs as Squad,
  bar: squadBar as Squad,
  bra: squadBra as Squad,
  esp: squadEsp as Squad,
  fra: squadFra as Squad,
  int: squadInt as Squad,
  jpn: squadJpn as Squad,
  psg: squadPsg as Squad,
  rma: squadRma as Squad,
};
