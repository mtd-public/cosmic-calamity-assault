// In-engine self-test (tools/gz-smoke.sh sets cca_selftest 1). Exercises the
// gameplay code inside real GZDoom and prints "CCA-SELFTEST PASS n" or
// "CCA-SELFTEST FAIL: ..." lines for the smoke script to grep.
class CCASelfTest : EventHandler
{
	int t, pass, fail;
	Array<Actor> spawned;

	void Check(bool ok, String what)
	{
		if (ok) pass++;
		else { fail++; Console.Printf("CCA-SELFTEST FAIL: %s", what); }
	}

	override void WorldTick()
	{
		if (!CVar.FindCVar("cca_selftest") || CVar.FindCVar("cca_selftest").GetInt() == 0) return;
		let p = players[consoleplayer].mo;
		if (!p) return;
		t++;
		if (CVar.FindCVar("cca_selftest").GetInt() == 2) { Walk(p); return; }
		if (t == 5) StepSpawnAll(p);
		if (t == 40) StepWeapons(p);
		if (t == 60) StepMission(p);
		if (t == 120) StepCleanup(p);
		if (t == 121) Console.Printf("CCA-SELFTEST %s %d/%d", fail ? "FAIL" : "PASS", pass, pass + fail);
	}

	// ------------------------------------------------------------------ walkthrough (cca_selftest 2)
	// Plays the level's objective chain in-engine: objective items, hack
	// terminals (fast-forwarded), boss kill, exit gate, exit line. Proves the
	// map's tags and specials actually work, not just that areas connect.
	int wstep, wwait;
	void Say2(String s) { Console.Printf("CCA-WALK %s", s); }
	override void WorldUnloaded(WorldEvent e)
	{
		let cv = CVar.FindCVar("cca_selftest");
		if (cv && cv.GetInt() == 2 && wstep >= 5) Console.Printf("CCA-WALK PASS: %s exited", Level.MapName);
	}
	void Walk(Actor p)
	{
		let ev = CCAEvents.Get();
		if (!ev) return;
		if (wwait > 0) { wwait--; return; }
		p.bNoTarget = true; p.bInvulnerable = true;
		switch (wstep)
		{
		case 0:   // objective items
		{
			let it = ThinkerIterator.Create("CCAObjectiveItem");
			let item = CCAObjectiveItem(it.Next());
			if (item) { p.SetOrigin(item.pos, false); Say2("pickup " .. item.GetClassName()); item.Touch(p); wwait = 10; return; }
			wstep = 1; return;
		}
		case 1:   // hack terminals
		{
			let it = ThinkerIterator.Create("HackTerminal");
			HackTerminal term;
			while ((term = HackTerminal(it.Next())) != null)
			{
				if (term.done) continue;
				if (!term.active) { term.Used(p); Say2("hack " .. term.args[0] .. "s"); }
				p.SetOrigin(term.pos + (p.AngleToVector(0, 48), 0), false);
				term.progress = max(term.progress, term.total - 2);
				wwait = 12;
				return;
			}
			wwait = 20; wstep = 2; return;   // items the terminals opened (HDD) come next
		}
		case 2:   // objective items revealed by terminals
		{
			let it = ThinkerIterator.Create("CCAObjectiveItem");
			let item = CCAObjectiveItem(it.Next());
			if (item) { p.SetOrigin(item.pos, false); Say2("pickup " .. item.GetClassName()); item.Touch(p); wwait = 10; return; }
			wstep = 3; return;
		}
		case 3:   // boss
		{
			let it = ThinkerIterator.Create("HiveMind");
			let boss = HiveMind(it.Next());
			if (boss && boss.health > 0)
			{
				if (boss.bInvulnerable) { Say2("FAIL: hive mind still shielded after the objectives"); wstep = 99; return; }
				boss.DamageMobj(p, p, boss.health + 10, 'None', DMG_FORCED);
				Say2("hive mind killed"); wwait = 90; return;
			}
			wstep = 4; wwait = 40; return;
		}
		case 4:   // exit gate should have opened
		{
			let it = ThinkerIterator.Create("ExitGate");
			ExitGate g; bool allOpen = true; int n = 0;
			while ((g = ExitGate(it.Next())) != null) { n++; if (!g.opened) allOpen = false; }
			String objs = "";
			for (int i = 0; i < ev.objDone.Size(); i++) objs = objs .. (ev.objDone[i] ? "x" : "-");
			Say2(String.Format("objectives [%s], exit gates %d %s", objs, n, allOpen ? "open" : "CLOSED"));
			if (!allOpen) { Say2("FAIL: exit gate still closed"); wstep = 99; return; }
			wstep = 5; wwait = 70; return;   // let the door open
		}
		case 5:   // the exit line
		{
			for (int i = 0; i < Level.Lines.Size(); i++)
			{
				Line ln = Level.Lines[i];
				if (ln.special != 243 && ln.special != 244) continue;   // Exit_Normal / Exit_Secret
				if (ln.special == 244) continue;
				Vector2 mid = (ln.v1.p + ln.v2.p) / 2;
				Vector2 nrm = (ln.delta.y, -ln.delta.x).Unit();     // front side
				p.SetOrigin((mid + nrm * 24, ln.frontsector.floorplane.ZAtPoint(mid + nrm * 24)), false);
				p.angle = atan2(-nrm.y, -nrm.x);
				int act = (ln.activation & SPAC_Use) ? SPAC_Use : (ln.activation & SPAC_Cross) ? SPAC_Cross : SPAC_Use;
				Say2(String.Format("exit line %d (%s)", i, act == SPAC_Use ? "use" : "cross"));
				ln.Activate(p, 0, act);
				wstep = 6; wwait = 100;
				return;
			}
			Say2("FAIL: no exit line"); wstep = 99; return;
		}
		case 6:
			Say2("FAIL: still on the map after the exit line"); wstep = 99; return;
		}
	}

	void StepSpawnAll(Actor p)
	{
		static const Name classes[] = {
			'Thrall', 'ThrallTrooper', 'Grey', 'Hybrid', 'CCAStalker', 'Probe', 'Overseer',
			'Scientist', 'LabTech', 'DownedGuard', 'GuardAlly', 'DeadGuard', 'DeadScientist',
			'HackTerminal', 'WaveSpot', 'ObjectiveMarker', 'IrisTrigger', 'ExitGate', 'Curtain', 'RandomFire',
			'PropDesk', 'PropTank', 'ExplosiveDrum', 'PropHiveConduit', 'LightLamp', 'LightAlarm', 'LightNeon',
			'Ammo9mmMag', 'AmmoShellBox', 'Ammo556Box', 'Ammo762Mag', 'AlienEnergyPod', 'FragPickup', 'DetonatorPickup',
			'Stim', 'Medkit', 'AlienImplant', 'KevlarVest', 'TacticalArmor', 'FlashlightBattery',
			'CCABlueCard', 'CCARedCard', 'CCAYellowCard'
		};
		for (int i = 0; i < classes.Size(); i++)
		{
			class<Actor> c = classes[i];
			Check(c != null, "class exists: " .. classes[i]);
			if (!c) continue;
			let a = Actor.Spawn(c, p.pos + (p.AngleToVector(p.angle, 400 + (i % 6) * 60), 0) + (0, 0, 0), ALLOW_REPLACE);
			Check(a != null, "spawn " .. classes[i]);
			if (a) { a.bDormant = true; spawned.Push(a); }
		}
	}

	void StepWeapons(Actor p)
	{
		static const Name guns[] = { 'CCA_Knife', 'CCA_Pistol', 'CCA_Shotgun', 'CCA_SMG', 'CCA_AssaultRifle', 'CCA_BattleRifle',
			'CCA_HarvesterBlade', 'CCA_Stinger', 'CCA_Scatter', 'CCA_PlasmaSMG', 'CCA_Singularity' };
		p.A_GiveInventory("Ammo9mm", 200); p.A_GiveInventory("Ammo12g", 50); p.A_GiveInventory("Ammo556", 240);
		p.A_GiveInventory("Ammo762", 120); p.A_GiveInventory("AlienEnergy", 300);
		for (int i = 0; i < guns.Size(); i++)
		{
			p.A_GiveInventory(guns[i], 1);
			class<Inventory> gc = guns[i];
			let inv = p.FindInventory(gc);
			let w = CCAWeapon(inv);
			// Weapon.TryPickup refuses a weapon whose Ready sprite is missing: this also checks the HUD art exists
			Check(w != null, String.Format("give %s (its Ready HUD sprite must exist)", guns[i]));
			if (!w) continue;
			Check(w.FindState("Ready") != null && w.FindState("Fire") != null, guns[i] .. " has Ready/Fire");
			if (w.adsZoom > 0) Check(w.FindState("ADSReady") != null && w.FindState("ADSFire") != null, guns[i] .. " has ADS states");
			if (w.canDual) Check(w.FindState("LeftReady") != null && w.FindState("LeftFire") != null, guns[i] .. " has dual states");
			if (w.magSize > 0)
			{
				Check(w.mag == w.magSize, guns[i] .. " starts with a full magazine");
				int before = w.mag;
				if (w.TakeRound(false)) w.ShootRounds(p, false);
				Check(w.mag == before - 1, guns[i] .. " fires from the magazine");
				w.FillMag(false);
				Check(w.mag == w.magSize, guns[i] .. " reloads");
				// second copy → dual
				p.A_GiveInventory(guns[i], 1);
				Check(w.hasPair, guns[i] .. " pair picked up");
				w.WantDual(true);
				Check(w.dual, guns[i] .. " dual on");
				w.WantDual(false);
			}
			else if (w.Ammo1)
			{
				int before = w.Reserve();
				if (w.TakeRound(false)) w.ShootRounds(p, false);
				Check(w.Reserve() < before, guns[i] .. " consumes energy");
			}
		}
		// grenades
		p.A_GiveInventory("FragGrenades", 2);
		let g = CCAFragThrown(Actor.Spawn("CCAFragThrown", p.pos + (p.AngleToVector(p.angle, 600), 32)));
		Check(g != null, "frag spawns");
		if (g) g.fuse = 3;
		let d = Actor.Spawn("CCADetonatorThrown", p.pos + (p.AngleToVector(p.angle + 90, 600), 32));
		Check(d != null, "detonator spawns");
	}

	void StepMission(Actor p)
	{
		let ev = CCAEvents.Get();
		Check(ev != null, "event handler");
		if (!ev) return;
		// terminal: start, fast-forward, finish
		let term = HackTerminal(Actor.Spawn("HackTerminal", p.pos + (p.AngleToVector(p.angle - 90, 96), 0)));
		Check(term != null, "terminal spawns");
		if (term)
		{
			term.args[0] = 60; term.args[4] = 0;
			term.Used(p);
			Check(term.active, "terminal starts on use");
			term.progress = term.total;
			term.Tick();
			Check(term.done, "terminal completes");
		}
		// revive
		let dg = DownedGuard(Actor.Spawn("DownedGuard", p.pos + (p.AngleToVector(p.angle + 180, 96), 0)));
		Check(dg != null, "downed guard spawns");
		if (dg) { dg.args[0] = 1; dg.reviver = p; dg.Revive(); Check(p.FindInventory("CCABlueCard") != null, "revived guard hands over the blue card"); }
		// objectives (if the map defines any)
		if (ev.objText.Size() > 0)
		{
			int cur = ev.CurrentObjective();
			ev.Complete(cur);
			Check(ev.IsDone(cur), "objective completes");
		}
		ev.Say("IRIS_HACK_START");
		Check(ev.subText.Size() > 0, "IRIS subtitle queued");
		// flashlight + dual toggles through the player
		let cp = CCAPlayer(p);
		Check(cp != null, "player class is CCAPlayer");
		if (cp) { cp.ToggleFlashlight(); Check(cp.flashOn, "flashlight on"); }
	}

	void StepCleanup(Actor p)
	{
		for (int i = 0; i < spawned.Size(); i++) if (spawned[i] && !spawned[i].player) spawned[i].Destroy();
	}
}
