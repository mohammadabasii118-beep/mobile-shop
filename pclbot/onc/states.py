from aiogram.fsm.state import State, StatesGroup


class CreateSt(StatesGroup):
    name = State()
    date = State()
    time = State()
    interval = State()
    confirm = State()


class TeamSt(StatesGroup):
    name = State()
    logo = State()
    rename = State()
    newlogo = State()
    players = State()


class GroupSt(StatesGroup):
    rename = State()


class ResultSt(StatesGroup):
    ga = State()
    gb = State()
    winner = State()
    preview = State()
    impact = State()


class TieSt(StatesGroup):
    pick = State()


class ChanSt(StatesGroup):
    chat = State()


class TplSt(StatesGroup):
    bg = State()
    set_name = State()


class PclSt(StatesGroup):
    logo = State()


class TourSt(StatesGroup):
    edit = State()


class CaptSt(StatesGroup):
    add = State()          # admin: adding a captain/manager to a team
    ga = State()           # captain: result entry
    gb = State()
    winner = State()
    preview = State()
    list = State()         # captain: team list
    list_preview = State()
