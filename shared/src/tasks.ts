import type { BoxType } from './types';

/** انواع تسک هفتگی */
export type TaskType = 'solo_win' | 'online_win' | 'open_box' | 'upgrade_card' | 'spend_coins' | 'win_streak';
export const TASK_TYPES: TaskType[] = ['solo_win', 'online_win', 'open_box', 'upgrade_card', 'spend_coins', 'win_streak'];

/** اسم کوتاه هر نوع (برای انتخاب در پنل مدیریت) */
export const TASK_NAME: Record<TaskType, string> = {
  solo_win: 'بردن در تک‌نفره',
  online_win: 'بردن در آنلاین',
  open_box: 'باز کردن جعبه',
  upgrade_card: 'ارتقای کارت',
  spend_coins: 'خرج کردن سکه',
  win_streak: 'برد پشت‌سرهم',
};

/** متن کامل تسک با عدد هدف */
export const taskText = (type: TaskType, target: number, f: (n: number) => string = String): string => {
  switch (type) {
    case 'solo_win': return `${f(target)} بار در حالت تک‌نفره ببر`;
    case 'online_win': return `${f(target)} بار در حالت آنلاین ببر`;
    case 'open_box': return `${f(target)} جعبه باز کن`;
    case 'upgrade_card': return `${f(target)} بار یک کارت را ارتقا بده`;
    case 'spend_coins': return `${f(target)} سکه خرج کن`;
    case 'win_streak': return `${f(target)} برد پشت‌سرهم بگیر`;
  }
};

export type RewardKind = 'coins' | 'gems' | 'xp' | 'box';
export interface TaskReward { kind: RewardKind; amount: number; /** فقط برای جعبه */ box?: BoxType }
export const REWARD_KINDS: RewardKind[] = ['coins', 'gems', 'xp', 'box'];

/** متن جایزه؛ boxName اسم نوع جعبه است */
export const rewardLabel = (r: TaskReward, boxName: (b: BoxType) => string = (b) => b, f: (n: number) => string = String): string =>
  r.kind === 'coins' ? `${f(r.amount)} سکه` : r.kind === 'gems' ? `${f(r.amount)} الماس` : r.kind === 'xp' ? `${f(r.amount)} XP` : `${f(r.amount)} جعبه‌ی ${boxName(r.box ?? 'bronze')}`;

/** نمونه‌ی تسک در «پایگاه نمونه‌ها»ی config (weekly.pool): diff = سختی ۱ تا ۵ */
export interface TaskTpl { id: string; type: TaskType; target: number; diff: number }

/** یک ردیف تسک برای نمایش به بازیکن */
export interface TaskView { slot: number; type: TaskType; target: number; progress: number; claimed: boolean; reward: TaskReward }
export interface TaskState { week: number; resetInMs: number; tasks: TaskView[] }
