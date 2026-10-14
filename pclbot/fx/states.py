from aiogram.fsm.state import State, StatesGroup


class SubSt(StatesGroup):
    receipt = State()
    reject = State()
    setting = State()


class BlSt(StatesGroup):
    pid = State()
    reason = State()
    search = State()


class DraftSt(StatesGroup):
    gid = State()
    pos1 = State()
    pos2 = State()


class StreamSt(StatesGroup):
    add = State()
    uname = State()
    photo = State()
    title = State()
    link = State()
    more = State()
    preview = State()


class QuizSt(StatesGroup):
    title = State()
    prize = State()
    when = State()
    counts = State()
    import_file = State()


class XiSt(StatesGroup):
    title = State()
    pid = State()
    photo = State()
    team = State()
    logo = State()


class VpnSt(StatesGroup):
    name = State()
    quota = State()
    days = State()
    price = State()


class DestSt(StatesGroup):
    pick = State()


class GfxSt(StatesGroup):
    date = State()
