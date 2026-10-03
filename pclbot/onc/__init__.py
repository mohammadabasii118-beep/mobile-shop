"""ONE NIGHT CHAMPION — a tournament module that lives inside the PCL bot next to TRANSFER.

Isolation rules: its own tables (onc_*), its own sqlite connection (see dbx.py), its own callback namespace (`onc:`),
its own FSM state groups and its own publishing destination (onc_settings.channel_id). It never touches
the Transfer tables, Transfer settings or the Transfer publish chat.
"""
