// People. Scientists and lab techs flee from aliens (they are friendlies the
// aliens hunt); downed guards can be revived by holding use for 3 s and then
// fight beside you as Guard allies (Half-Life's security guard).

class CCANPC : Actor abstract
{
	int lineCooldown;
	int panicTics;
	Default
	{
		Monster;
		+FRIENDLY
		+FRIGHTENED
		-COUNTKILL
		+NOINFIGHTING
		+FLOORCLIP
		+DONTHARMSPECIES
		Health 30; Radius 14; Height 56; Speed 9; PainChance 255; Mass 100;
		Scale 0.5;
		BloodType "CCARedBlood";
		Species "Human";
	}
	// Using a scientist: a line from them (random pick), rate-limited.
	override bool Used(Actor user)
	{
		if (health <= 0 || lineCooldown > Level.maptime) return false;
		lineCooldown = Level.maptime + 105;
		let ev = CCAEvents.Get();
		if (ev) ev.Say(String.Format("NPC_SCI%d", random(1, 8)));
		A_StartSound("npc/scientist", CHAN_VOICE);
		return true;
	}
	// Flee from the nearest hostile; cower when it is close and we're cornered.
	void FindThreat()
	{
		Actor best = null; double bd = 640;
		let it = BlockThingsIterator.Create(self, 640);
		while (it.Next())
		{
			let m = it.thing;
			if (!m || m == self || m.health <= 0 || !m.bIsMonster || m.bFriendly) continue;
			double d = Distance2D(m);
			if (d < bd && CheckSight(m)) { bd = d; best = m; }
		}
		if (best) { target = best; panicTics = 105; }
	}
}

class Scientist : CCANPC
{
	Default { SeeSound "npc/scream"; PainSound "npc/pain"; DeathSound "npc/death"; Tag "$C51_TAG_SCIENTIST"; Obituary "$C51_OB_NPC"; }
	States
	{
	Spawn:
		SCI1 E 10 { A_Look(); FindThreat(); if (target) return ResolveState("See"); return ResolveState(null); }
		Loop;
	See:
		SCI1 AABBCCDD 2
		{
			if ((Level.maptime & 15) == 0) FindThreat();
			if (target && target.health > 0 && Distance2D(target) < 96 && random(0, 255) < 64) return ResolveState("Cower");
			if (--panicTics <= 0 || !target || target.health <= 0) { A_ClearTarget(); return ResolveState("Idle"); }
			A_Chase(null, null, CHF_NOPLAYACTIVE);
			return ResolveState(null);
		}
		Loop;
	Idle:
		SCI1 E 12 { FindThreat(); if (target) return ResolveState("See"); A_Wander(); return ResolveState(null); }
		Loop;
	Cower:
		SCI1 F 35 A_StartSound("npc/whimper", CHAN_VOICE);
		SCI1 E 20;
		Goto See;
	Pain:
		SCI1 G 4 A_Pain;
		Goto See;
	Death:
		SCI1 H 5;
		SCI1 I 5 A_Scream;
		SCI1 J 5 A_NoBlocking;
		SCI1 K 5 A_SpawnItemEx("CCABloodPool");
		SCI1 L -1;
		Stop;
	}
}
class LabTech : Scientist
{
	States
	{
	Spawn:
		SCI2 E 10 { A_Look(); FindThreat(); if (target) return ResolveState("See"); return ResolveState(null); }
		Loop;
	See:
		SCI2 AABBCCDD 2
		{
			if ((Level.maptime & 15) == 0) FindThreat();
			if (target && target.health > 0 && Distance2D(target) < 96 && random(0, 255) < 64) return ResolveState("Cower");
			if (--panicTics <= 0 || !target || target.health <= 0) { A_ClearTarget(); return ResolveState("Idle"); }
			A_Chase(null, null, CHF_NOPLAYACTIVE);
			return ResolveState(null);
		}
		Loop;
	Idle:
		SCI2 E 12 { FindThreat(); if (target) return ResolveState("See"); A_Wander(); return ResolveState(null); }
		Loop;
	Cower:
		SCI2 F 35 A_StartSound("npc/whimper", CHAN_VOICE);
		SCI2 E 20;
		Goto See;
	Pain:
		SCI2 G 4 A_Pain;
		Goto See;
	Death:
		SCI2 H 5;
		SCI2 I 5 A_Scream;
		SCI2 J 5 A_NoBlocking;
		SCI2 K 5 A_SpawnItemEx("CCABloodPool");
		SCI2 L -1;
		Stop;
	}
}

// ---------------------------------------------------------------- downed guard
// args[0]: 0 nothing, 1 blue card, 2 red card, 3 yellow card (handed over when revived)
// args[1]: 1 = rifle ally instead of pistol
// Hold use on him for 3 s (the HUD shows a gauge). Being hurt cancels.
class DownedGuard : Actor
{
	Actor reviver;
	int reviveTics;
	int callTimer;
	const REVIVE_TICS = 105;
	Default
	{
		Health 40; Radius 16; Height 32; Mass 1000;
		+SHOOTABLE +SOLID +FRIENDLY +NOTAUTOAIMED +FLOORCLIP
		-COUNTKILL
		Scale 0.5;
		BloodType "CCARedBlood";
		PainChance 0;
		DeathSound "npc/guarddeath";
		Tag "$C51_TAG_DOWNED";
	}
	override void PostBeginPlay() { Super.PostBeginPlay(); callTimer = random(70, 210); }
	override bool Used(Actor user)
	{
		if (health <= 0 || !user.player) return false;
		if (!reviver) { reviver = user; reviveTics = 0; A_StartSound("npc/revivestart", CHAN_BODY); }
		return true;
	}
	override int DamageMobj(Actor inflictor, Actor source, int damage, Name mod, int flags, double angle)
	{
		reviver = null; reviveTics = 0;
		return Super.DamageMobj(inflictor, source, damage, mod, flags, angle);
	}
	override void Tick()
	{
		Super.Tick();
		if (isFrozen() || health <= 0) return;
		let ev = CCAEvents.Get();
		if (reviver)
		{
			bool holding = reviver.player && (reviver.player.cmd.buttons & BT_USE) && Distance3D(reviver) < 112 && reviver.health > 0;
			if (!holding) { reviver = null; reviveTics = 0; if (ev && ev.reviveTarget == self) ev.reviveTarget = null; return; }
			reviveTics++;
			if (ev) { ev.reviveTarget = self; ev.reviveFrac = double(reviveTics) / REVIVE_TICS; }
			if (reviveTics >= REVIVE_TICS) Revive();
			return;
		}
		if (--callTimer <= 0)
		{
			callTimer = random(280, 560);
			let p = players[consoleplayer].mo;
			if (p && Distance2D(p) < 768 && CheckSight(p)) { A_StartSound("npc/guardhelp", CHAN_VOICE); if (ev && random(0, 2) == 0) ev.Say("NPC_GUARDHELP"); }
		}
	}
	void Revive()
	{
		let ev = CCAEvents.Get();
		if (ev) { ev.reviveTarget = null; ev.Say(String.Format("NPC_GUARDUP%d", random(1, 4))); }
		class<Inventory> card = null;
		switch (args[0]) { case 1: card = "CCABlueCard"; break; case 2: card = "CCARedCard"; break; case 3: card = "CCAYellowCard"; break; }
		if (card && reviver) reviver.A_GiveInventory(card, 1);
		let ally = Spawn("GuardAlly", pos, ALLOW_REPLACE);
		if (ally)
		{
			ally.angle = angle;
			ally.bFriendly = true;
			ally.FriendPlayer = reviver && reviver.player ? reviver.PlayerNumber() + 1 : 0;
			ally.args[1] = args[1];
		}
		A_StartSound("npc/guardup", CHAN_VOICE);
		Destroy();
	}
	States
	{
	Spawn:
		GRDW AB 20;
		GRDW A 20;
		GRDW C 15;
		Loop;
	Death:
		GRDW E 6 A_Scream;
		GRDW F 6 A_NoBlocking;
		GRDW G 6;
		GRDW H -1;
		Stop;
	}
}

// ---------------------------------------------------------------- guard ally
// 60 HP, 9 mm hitscan 3*random(1,5) (rifle: 3 rounds), follows the player.
class GuardAlly : Actor
{
	Default
	{
		Monster;
		+FRIENDLY -COUNTKILL +FLOORCLIP +NOINFIGHTING
		Health 60; Radius 16; Height 56; Speed 10; PainChance 150; Mass 100;
		Scale 0.5;
		BloodType "CCARedBlood";
		MaxTargetRange 1536;
		SeeSound "npc/guardsight"; PainSound "npc/guardpain"; DeathSound "npc/guarddeath";
		AttackSound "weapons/pistol";
		Obituary "$C51_OB_GUARD";
		Tag "$C51_TAG_GUARD";
		Species "Human";
		+DONTHARMSPECIES
	}
	States
	{
	Spawn:
		GRDA A 10 A_Look;
		Loop;
	See:
		GRDA AABBCCDD 3 A_Chase;
		Loop;
	Missile:
		GRDA E 8 A_FaceTarget;
		GRDA F 4 Bright { A_CustomBulletAttack(8, 0, args[1] ? 3 : 1, 3 * random(1, 5), "CCABulletPuff", 0, CBAF_NORANDOM); A_StartSound(args[1] ? "weapons/rifle" : "weapons/pistol", CHAN_WEAPON); }
		GRDA E 6 A_MonsterRefire(60, "See");
		Goto Missile + 1;
	Pain:
		GRDA G 4 A_Pain;
		Goto See;
	Death:
		GRDA H 5;
		GRDA I 5 A_Scream;
		GRDA J 5 A_NoBlocking;
		GRDA K 5 A_SpawnItemEx("CCABloodPool");
		GRDA L -1;
		Stop;
	}
}

// ---------------------------------------------------------------- corpses
class CCACorpse : Actor abstract
{
	Default { Radius 16; Height 8; Scale 0.5; +NOBLOCKMAP; +MOVEWITHSECTOR; }
}
class DeadGuard : CCACorpse     { States { Spawn: DEDB A -1; Stop; } }
class DeadScientist : CCACorpse { States { Spawn: DEDB B -1; Stop; } }
class DeadLabTech : CCACorpse   { States { Spawn: DEDB C -1; Stop; } }
class DeadSoldier : CCACorpse   { States { Spawn: DEDB D -1; Stop; } }
class CCABloodPool : Actor
{
	Default { +NOBLOCKMAP; +NOINTERACTION; +FLATSPRITE; Scale 0.5; }
	States { Spawn: DBLD A -1; Stop; }
}
