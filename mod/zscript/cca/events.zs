// Per-level game state: objectives, IRIS / radio subtitles, secret hints,
// hack and revive gauges, and the key toggles that arrive as net events
// (flashlight, dual wield, grenade type, IRIS repeat). Lives in play scope;
// the HUD reads it (ui may read play data).

enum ESpeaker { SPK_IRIS, SPK_MARSH, SPK_KADE, SPK_CUSTODIAN, SPK_GUARD, SPK_SCIENTIST, SPK_HUM, SPK_CIVILIAN }

class CCAEvents : EventHandler
{
	// ---------------------------------------------------------------- objectives
	Array<String> objText;
	Array<bool> objDone;
	int objFlashTic;           // HUD highlight when an objective changes
	int pendingAutosave;       // tics until an autosave (after an objective)

	// ---------------------------------------------------------------- subtitles
	Array<String> subText;
	Array<int> subSpeaker;
	int subTic;                // tics the current line has been shown
	int talkTics;              // >0 while IRIS "talks" (avatar animation)
	int alarmTics;             // >0: IRIS alarm face (hostiles / hurt)

	// ---------------------------------------------------------------- secrets
	Array<int> secretSectors;
	Array<bool> secretHinted;

	// ---------------------------------------------------------------- gauges (HUD)
	Actor hackTerminal;        // the terminal being hacked (HUD gauge)
	Actor reviveTarget;        // the guard being revived
	double reviveFrac;
	int hitMarkerTic;
	int waypointPulse;
	// ---------------------------------------------------------------- civilians (rescue)
	int civTotal, civSaved, civLost;
	int civFlashTic;
	// computed in play scope for the UI (it can't trace or iterate thinkers)
	Vector3 wpPos;
	bool wpValid;
	bool aimHostile;

	clearscope static CCAEvents Get() { return CCAEvents(EventHandler.Find("CCAEvents")); }

	// ------------------------------------------------------------------ setup
	override void WorldLoaded(WorldEvent e)
	{
		objText.Clear(); objDone.Clear();
		String map = Level.MapName.MakeUpper();
		for (int i = 1; i <= 9; i++)
		{
			String key = String.Format("OBJ_%s_%d", map, i);
			String txt = StringTable.Localize("$" .. key);
			if (txt == key || txt.Length() == 0) break;
			objText.Push(txt); objDone.Push(false);
		}
		secretSectors.Clear(); secretHinted.Clear();
		for (int i = 0; i < Level.Sectors.Size(); i++)
		{
			if (Level.Sectors[i].IsSecret()) { secretSectors.Push(i); secretHinted.Push(false); }
		}
		if (!e.IsSaveGame)
		{
			civTotal = civSaved = civLost = 0;
			let ci = ThinkerIterator.Create("CCANPC");
			CCANPC n;
			while ((n = CCANPC(ci.Next())) != null) if (n.rescuable) civTotal++;
			String start = "IRIS_" .. map .. "_START";
			String txt = StringTable.Localize("$" .. start);
			if (txt != start) Say(start, 70);
			pendingAutosave = 35;   // autosave just after the map starts
		}
	}

	// ------------------------------------------------------------------ objectives API (play)
	clearscope int CurrentObjective() const
	{
		for (int i = 0; i < objDone.Size(); i++) if (!objDone[i]) return i + 1;
		return 0;
	}
	clearscope bool IsDone(int id) const { return id >= 1 && id <= objDone.Size() && objDone[id - 1]; }
	clearscope bool MaskDone(int mask) const
	{
		for (int i = 0; i < 16; i++) if ((mask & (1 << i)) && !IsDone(i + 1)) return false;
		return true;
	}
	void Complete(int id)
	{
		if (id < 1 || id > objDone.Size() || objDone[id - 1]) return;
		objDone[id - 1] = true;
		objFlashTic = Level.maptime;
		pendingAutosave = 50;
		S_StartSound("iris/objective", CHAN_AUTO, CHANF_UI, 1.0, ATTN_NONE);
		String key = String.Format("IRIS_%s_OBJ%d", Level.MapName.MakeUpper(), id);
		if (StringTable.Localize("$" .. key) != key) Say(key);
	}

	// ------------------------------------------------------------------ civilians API
	void CivilianSaved(Actor who)
	{
		civSaved++;
		civFlashTic = Level.maptime;
		S_StartSound("iris/objective", CHAN_AUTO, CHANF_UI, 0.6, ATTN_NONE);
		if (civSaved + civLost >= civTotal && civLost == 0) Say("IRIS_CIV_ALL");
		else Say(String.Format("NPC_OFCTHANKS%d", random(1, 6)));
	}
	void CivilianLost(Actor who)
	{
		civLost++;
		civFlashTic = Level.maptime;
		if (civLost == 1) Say("IRIS_CIV_LOST");
	}
	// Idle aliens that can't see the player go after civilians they can see.
	void HuntCivilians()
	{
		let ci = ThinkerIterator.Create("CCANPC");
		CCANPC n;
		while ((n = CCANPC(ci.Next())) != null)
		{
			if (!n.rescuable || n.saved || n.health <= 0) continue;
			int hunters = 0;
			let it = BlockThingsIterator.Create(n, 768);
			while (it.Next() && hunters < 2)
			{
				let m = it.thing;
				if (!m || m.health <= 0 || !m.bIsMonster || m.bFriendly || m.bDormant) continue;
				if (m.target == n) { hunters++; continue; }
				bool busy = m.target && m.target.health > 0 && (m.target.player ? m.CheckSight(m.target) : true);
				if (busy || m.Distance3D(n) > 768 || !m.CheckSight(n)) continue;
				m.target = n;
				if (m.InStateSequence(m.CurState, m.SpawnState) && m.SeeState) m.SetState(m.SeeState);
				hunters++;
			}
		}
	}

	// ------------------------------------------------------------------ subtitles API
	// A LANGUAGE value is "SPEAKER|text", e.g. "IRIS|Door's jammed. Try the vent."
	void Say(String key, int delay = 0)
	{
		String raw = StringTable.Localize("$" .. key);
		if (raw == key) raw = key;
		int spk = SPK_IRIS;
		int bar = raw.IndexOf("|");
		if (bar > 0)
		{
			String who = raw.Left(bar).MakeUpper();
			raw = raw.Mid(bar + 1);
			if (who == "MARSH") spk = SPK_MARSH;
			else if (who == "KADE") spk = SPK_KADE;
			else if (who == "CUSTODIAN") spk = SPK_CUSTODIAN;
			else if (who == "GUARD") spk = SPK_GUARD;
			else if (who == "SCIENTIST") spk = SPK_SCIENTIST;
			else if (who == "HUM") spk = SPK_HUM;
			else if (who == "OFFICE WORKER" || who == "CIVILIAN") spk = SPK_CIVILIAN;
		}
		// avoid stacking the same line twice
		for (int i = 0; i < subText.Size(); i++) if (subText[i] == raw) return;
		subText.Push(raw); subSpeaker.Push(spk);
		if (subText.Size() == 1) subTic = -delay;
	}
	void SayText(String txt, int spk = SPK_IRIS) { subText.Push(txt); subSpeaker.Push(spk); if (subText.Size() == 1) subTic = 0; }
	clearscope int LineTics(String s) const { return 70 + s.CodePointCount() * 2; }   // ~2.2 s + reading time

	// ------------------------------------------------------------------ tick
	override void WorldTick()
	{
		// subtitles
		if (subText.Size() > 0)
		{
			subTic++;
			if (subTic == 1)
			{
				int spk = subSpeaker[0];
				S_StartSound(spk == SPK_IRIS ? "iris/chirp" : "iris/radio", CHAN_AUTO, CHANF_UI, 0.7, ATTN_NONE);
			}
			if (subTic > 0 && subSpeaker[0] == SPK_IRIS) talkTics = 4;
			if (subTic > LineTics(subText[0])) { subText.Delete(0); subSpeaker.Delete(0); subTic = 0; }
		}
		if (talkTics > 0) talkTics--;
		if (alarmTics > 0) alarmTics--;
		if (waypointPulse > 0) waypointPulse--;

		if (pendingAutosave > 0 && --pendingAutosave == 0) Level.MakeAutoSave();

		// secret hints (every half second)
		if ((Level.maptime % 17) == 0) CheckSecretHints();
		if (civTotal > 0 && (Level.maptime % 35) == 11) HuntCivilians();
		UpdateHudData();
	}

	void UpdateHudData()
	{
		let pmo = players[consoleplayer].mo;
		if (!pmo) return;
		// is the reticle over a live hostile?
		FLineTraceData d;
		aimHostile = pmo.LineTrace(pmo.angle, 4096, pmo.pitch, 0, players[consoleplayer].viewheight, 0, 0, d)
			&& d.HitType == TRACE_HitActor && d.HitActor && d.HitActor.bIsMonster && !d.HitActor.bFriendly && d.HitActor.health > 0;
		// waypoint: the marker for the current objective
		if ((Level.maptime % 10) == 0)
		{
			wpValid = false;
			int cur = CurrentObjective();
			if (cur <= 0) return;
			let it = ThinkerIterator.Create("ObjectiveMarker");
			Actor m;
			while ((m = Actor(it.Next())) != null) if (m.args[0] == cur) { wpPos = m.pos + (0, 0, 40); wpValid = true; break; }
		}
	}

	void CheckSecretHints()
	{
		let pmo = players[consoleplayer].mo;
		if (!pmo) return;
		for (int i = 0; i < secretSectors.Size(); i++)
		{
			if (secretHinted[i]) continue;
			Sector s = Level.Sectors[secretSectors[i]];
			if (!s.IsSecret()) { secretHinted[i] = true; continue; }   // already found
			Vector2 c = s.centerspot;
			if ((pmo.pos.xy - c).Length() < 224)
			{
				secretHinted[i] = true;
				Say(String.Format("IRIS_SECRET%d", 1 + Random(0, 3)));
			}
		}
	}

	override void WorldThingDamaged(WorldEvent e)
	{
		if (e.DamageSource && e.DamageSource.player && e.Thing != e.DamageSource && e.Thing.bIsMonster)
			hitMarkerTic = Level.maptime;
		if (e.Thing && e.Thing.player) alarmTics = 20;
	}

	// ------------------------------------------------------------------ key toggles
	override void NetworkProcess(ConsoleEvent e)
	{
		if (e.Player < 0 || !playeringame[e.Player]) return;
		let pmo = CCAPlayer(players[e.Player].mo);
		if (!pmo) return;
		if (e.Name == "cca_flashlight") pmo.ToggleFlashlight();
		else if (e.Name == "cca_dual") pmo.ToggleDual();
		else if (e.Name == "cca_gtype") pmo.CycleGrenade();
		else if (e.Name == "cca_iris")
		{
			int cur = CurrentObjective();
			if (cur > 0) SayText(objText[cur - 1], SPK_IRIS);
			waypointPulse = 105;
		}
	}
}
