// The invaders. Each maps onto a Doom archetype (GAME_DESIGN §5.2) so the
// balance can be read against the original; numbers carry their reason.
// Sprites: docs/ASSETS.md §1 (8 rotations for A-G, rot 0 deaths); Scale 0.5.

class CCAMonster : Actor abstract
{
	Default
	{
		Monster;
		+FLOORCLIP
		Scale 0.5;
		BloodType "CCAGreenBlood";   // luminous alien green; Thralls bleed black oil
	}
	// Speaking beats: IRIS calls out a new enemy type the first time one sees you.
	override void PostBeginPlay() { Super.PostBeginPlay(); }
}

// ---------------------------------------------------------------- Thrall (Zombieman)
// Possessed Area 51 security. 20 HP, pistol hitscan 3*random(1,5).
class Thrall : CCAMonster
{
	Default
	{
		Health 20; Radius 16; Height 56; Speed 8; PainChance 200; Mass 100;
		BloodType "CCAOilBlood";
		SeeSound "thrall/sight"; PainSound "thrall/pain"; DeathSound "thrall/death"; ActiveSound "thrall/active";
		AttackSound "weapons/pistol";
		Obituary "$C51_OB_THRALL";
		DropItem "Ammo9mmMag", 180;
		Tag "$C51_TAG_THRALL";
	}
	States
	{
	Spawn:
		THRL AB 10 A_Look;
		Loop;
	See:
		THRL AABBCCDD 4 A_Chase;
		Loop;
	Missile:
		THRL E 10 A_FaceTarget;
		THRL F 8 Bright A_CustomBulletAttack(22.5, 0, 1, 3 * random(1, 5), "CCABulletPuff", 0, CBAF_NORANDOM);
		THRL E 8;
		Goto See;
	Pain:
		THRL G 3;
		THRL G 3 A_Pain;
		Goto See;
	Death:
		THRL H 5;
		THRL I 5 A_Scream;
		THRL J 5 A_NoBlocking;
		THRL K 5 A_SpawnItemEx("OilPuddle");
		THRL L -1;
		Stop;
	XDeath:
		THRL M 5;
		THRL N 5 A_XScream;
		THRL O 5 A_NoBlocking;
		THRL P -1;
		Stop;
	Raise:
		THRL LKJIH 5;
		Goto See;
	}
}

// ---------------------------------------------------------------- Man in Black (Zombieman+)
// The Committee's own security (MAP02 Dulce on): human collaborators in black
// suits and sunglasses. 45 HP, quick silenced-pistol pairs 2 x 3*random(1,4),
// fast strafing. Red blood: they are people.
class ManInBlack : CCAMonster
{
	Default
	{
		Health 45; Radius 16; Height 56; Speed 10; PainChance 160; Mass 100;
		BloodType "CCARedBlood";
		SeeSound "mib/sight"; PainSound "mib/pain"; DeathSound "mib/death"; ActiveSound "mib/active";
		Obituary "$C51_OB_MIB";
		DropItem "Ammo9mmMag", 200;
		Tag "$C51_TAG_MIB";
		MinMissileChance 160;
		+AVOIDMELEE
	}
	States
	{
	Spawn:
		MIBK AB 10 A_Look;
		Loop;
	See:
		MIBK AABBCCDD 3 A_Chase;
		Loop;
	Missile:
		MIBK E 8 A_FaceTarget;
		MIBK F 4 Bright { A_CustomBulletAttack(5.6, 0, 1, 3 * random(1, 4), "CCABulletPuff", 0, CBAF_NORANDOM); A_StartSound("weapons/silenced", CHAN_WEAPON); }
		MIBK E 4 A_FaceTarget;
		MIBK F 4 Bright { A_CustomBulletAttack(5.6, 0, 1, 3 * random(1, 4), "CCABulletPuff", 0, CBAF_NORANDOM); A_StartSound("weapons/silenced", CHAN_WEAPON); }
		MIBK E 6;
		Goto See;
	Pain:
		MIBK G 3;
		MIBK G 3 A_Pain;
		Goto See;
	Death:
		MIBK H 5;
		MIBK I 5 A_Scream;
		MIBK J 5 A_NoBlocking;
		MIBK K 5 A_SpawnItemEx("CCABloodPool");
		MIBK L -1;
		Stop;
	XDeath:
		MIBK M 5;
		MIBK N 5 A_XScream;
		MIBK O 5 A_NoBlocking;
		MIBK P -1;
		Stop;
	Raise:
		MIBK LKJIH 5;
		Goto See;
	}
}

// ---------------------------------------------------------------- Thrall Trooper (Shotgun guy)
class ThrallTrooper : Thrall
{
	Default
	{
		Health 30; PainChance 170;
		AttackSound "weapons/shotgun";
		Obituary "$C51_OB_TROOPER";
		DropItem "AmmoShells", 200;
		Tag "$C51_TAG_TROOPER";
	}
	States
	{
	Spawn:
		THRS AB 10 A_Look;
		Loop;
	See:
		THRS AABBCCDD 3 A_Chase;
		Loop;
	Missile:
		THRS E 10 A_FaceTarget;
		THRS F 10 Bright A_CustomBulletAttack(22.5, 0, 3, 3 * random(1, 5), "CCABulletPuff", 0, CBAF_NORANDOM);
		THRS E 10;
		Goto See;
	Pain:
		THRS G 3;
		THRS G 3 A_Pain;
		Goto See;
	Death:
		THRS H 5;
		THRS I 5 A_Scream;
		THRS J 5 A_NoBlocking;
		THRS K 5 A_SpawnItemEx("OilPuddle");
		THRS L -1;
		Stop;
	XDeath:
		THRS M 5;
		THRS N 5 A_XScream;
		THRS O 5 A_NoBlocking;
		THRS P -1;
		Stop;
	Raise:
		THRS LKJIH 5;
		Goto See;
	}
}

// ---------------------------------------------------------------- Grey (Imp)
// 60 HP, slow psychic bolt 3*random(1,8) you can strafe, claw 3*random(1,8).
class Grey : CCAMonster
{
	Default
	{
		Health 60; Radius 14; Height 40; Speed 8; PainChance 200; Mass 70;
		SeeSound "grey/sight"; PainSound "grey/pain"; DeathSound "grey/death"; ActiveSound "grey/active";
		MeleeSound "grey/claw";
		Obituary "$C51_OB_GREY"; HitObituary "$C51_OB_GREYHIT";
		Tag "$C51_TAG_GREY";
		DropItem "AlienEnergyCell", 40;
	}
	States
	{
	Spawn:
		GREY AB 10 A_Look;
		Loop;
	See:
		GREY AABBCCDD 3 A_Chase;
		Loop;
	Melee:
		GREY G 6 A_FaceTarget;
		GREY G 6 A_CustomMeleeAttack(3 * random(1, 8), "grey/claw", "", "Melee", true);
		Goto See;
	Missile:
		GREY E 8 Bright A_FaceTarget;
		GREY F 6 Bright A_SpawnProjectile("GreyBolt", 26);
		GREY E 6;
		Goto See;
	Pain:
		GREY H 2;
		GREY H 2 A_Pain;
		Goto See;
	Death:
		GREY I 8;
		GREY J 8 A_Scream;
		GREY K 6;
		GREY L 6 A_NoBlocking;
		GREY M -1;
		Stop;
	Raise:
		GREY MLKJI 8;
		Goto See;
	}
}
class GreyBolt : Actor
{
	Default { Radius 6; Height 8; Speed 10; FastSpeed 20; DamageFunction (3 * random(1, 8)); Projectile; +RANDOMIZE; +ZDOOMTRANS; RenderStyle "Add"; Alpha 0.9; Scale 0.5; SeeSound "grey/boltfire"; DeathSound "grey/bolthit"; }
	States
	{
	Spawn:
		PBLT AB 4 Bright;
		Loop;
	Death:
		PBLT CDE 5 Bright;
		Stop;
	}
}

// ---------------------------------------------------------------- Hybrid (Chaingunner)
// 70 HP, bursts of 3 plasma bolts 3*random(1,5). Drops an alien carbine charge.
class Hybrid : CCAMonster
{
	Default
	{
		Health 70; Radius 16; Height 56; Speed 8; PainChance 170; Mass 100;
		SeeSound "hybrid/sight"; PainSound "hybrid/pain"; DeathSound "hybrid/death"; ActiveSound "hybrid/active";
		Obituary "$C51_OB_HYBRID";
		Tag "$C51_TAG_HYBRID";
		DropItem "AlienEnergyCell", 255;
	}
	States
	{
	Spawn:
		HYBR AB 10 A_Look;
		Loop;
	See:
		HYBR AABBCCDD 3 A_Chase;
		Loop;
	Missile:
		HYBR E 10 A_FaceTarget;
		HYBR F 3 Bright A_SpawnProjectile("HybridPlasma", 32, 8);
		HYBR E 3 A_FaceTarget;
		HYBR F 3 Bright A_SpawnProjectile("HybridPlasma", 32, 8);
		HYBR E 3 A_FaceTarget;
		HYBR F 3 Bright A_SpawnProjectile("HybridPlasma", 32, 8);
		HYBR E 8 A_MonsterRefire(40, "See");
		Goto Missile+1;
	Pain:
		HYBR G 3;
		HYBR G 3 A_Pain;
		Goto See;
	Death:
		HYBR H 5;
		HYBR I 5 A_Scream;
		HYBR J 5 A_NoBlocking;
		HYBR K 5;
		HYBR L -1;
		Stop;
	Raise:
		HYBR LKJIH 5;
		Goto See;
	}
}
class HybridPlasma : Actor
{
	Default { Radius 5; Height 6; Speed 20; FastSpeed 28; DamageFunction (3 * random(1, 5)); Projectile; RenderStyle "Add"; Scale 0.5; SeeSound "hybrid/fire"; DeathSound "weapons/plasmahit"; }
	States
	{
	Spawn:
		HPLS AB 3 Bright;
		Loop;
	Death:
		HPLS CDE 3 Bright;
		Stop;
	}
}

// ---------------------------------------------------------------- Stalker (Demon)
// 150 HP, fast, claw 4*random(1,10). Class renamed: Strife owns "Stalker".
class CCAStalker : CCAMonster
{
	Default
	{
		Health 150; Radius 22; Height 56; Speed 12; FastSpeed 20; PainChance 180; Mass 400;
		SeeSound "stalker/sight"; PainSound "stalker/pain"; DeathSound "stalker/death"; ActiveSound "stalker/active";
		Obituary "$C51_OB_STALKER";
		Tag "$C51_TAG_STALKER";
	}
	States
	{
	Spawn:
		STLK AB 10 A_Look;
		Loop;
	See:
		STLK AABBCCDD 2 Fast A_Chase;
		Loop;
	Melee:
		STLK E 6 Fast A_FaceTarget;
		STLK F 6 Fast A_FaceTarget;
		STLK G 6 Fast A_CustomMeleeAttack(4 * random(1, 10), "stalker/claw", "", "Melee", true);
		Goto See;
	Pain:
		STLK H 2 Fast;
		STLK H 2 Fast A_Pain;
		Goto See;
	Death:
		STLK I 8;
		STLK J 8 A_Scream;
		STLK K 4;
		STLK L 4 A_NoBlocking;
		STLK M -1;
		Stop;
	Raise:
		STLK MLKJI 5;
		Goto See;
	}
}

// ---------------------------------------------------------------- Probe (Cacodemon)
// 200 HP flying drone, pulse ball 5*random(1,8).
class Probe : CCAMonster
{
	Default
	{
		Health 200; Radius 24; Height 40; Speed 8; PainChance 128; Mass 400;
		+FLOAT +NOGRAVITY
		SeeSound "probe/sight"; PainSound "probe/pain"; DeathSound "probe/death"; ActiveSound "probe/active";
		Obituary "$C51_OB_PROBE";
		Tag "$C51_TAG_PROBE";
		BloodType "CCASparkBlood";
	}
	States
	{
	Spawn:
		PROB AB 10 A_Look;
		Loop;
	See:
		PROB AB 3 A_Chase;
		Loop;
	Missile:
		PROB C 5 A_FaceTarget;
		PROB D 5 Bright A_FaceTarget;
		PROB D 5 Bright A_SpawnProjectile("ProbePulse", 20);
		Goto See;
	Pain:
		PROB E 3;
		PROB E 3 A_Pain;
		PROB E 6;
		Goto See;
	Death:
		PROB F 8;
		PROB G 8 A_Scream;
		PROB H 6 Bright A_Explode(24, 64, 0);
		PROB I 6 Bright;
		PROB J 6 A_NoBlocking;
		PROB J -1;
		Stop;
	}
}
class ProbePulse : Actor
{
	Default { Radius 6; Height 8; Speed 10; FastSpeed 20; DamageFunction (5 * random(1, 8)); Projectile; RenderStyle "Add"; Scale 0.6; SeeSound "probe/fire"; DeathSound "probe/pulsehit"; }
	States
	{
	Spawn:
		PPLS AB 4 Bright;
		Loop;
	Death:
		PPLS CDE 5 Bright;
		Stop;
	}
}

// ---------------------------------------------------------------- Overseer (Arch-vile)
// 700 HP, raises dead aliens, psychic lance (vile attack): break line of sight.
class Overseer : CCAMonster
{
	Default
	{
		Health 700; Radius 20; Height 72; Speed 15; PainChance 10; Mass 500;
		MaxTargetRange 896;
		+QUICKTORETALIATE
		+NOTARGET
		SeeSound "overseer/sight"; PainSound "overseer/pain"; DeathSound "overseer/death"; ActiveSound "overseer/active";
		Obituary "$C51_OB_OVERSEER";
		Tag "$C51_TAG_OVERSEER";
	}
	States
	{
	Spawn:
		OVSR AB 10 A_Look;
		Loop;
	See:
		OVSR AABBCCDD 2 A_VileChase;
		Loop;
	Heal:
		OVSR E 10 Bright;
		OVSR F 10 Bright;
		Goto See;
	Missile:
		OVSR E 0 Bright A_VileStart;
		OVSR E 10 Bright A_FaceTarget;
		OVSR F 8 Bright A_VileTarget("OverseerLance");
		OVSR GHGHGH 8 Bright A_FaceTarget;
		OVSR H 8 Bright A_VileAttack("overseer/lancehit", 20, 70, 70, 1.0, 'Fire', VAF_DMGTYPEAPPLYTODIRECT);
		OVSR E 20 Bright;
		Goto See;
	Pain:
		OVSR I 5;
		OVSR I 5 A_Pain;
		Goto See;
	Death:
		OVSR J 7 A_Scream;
		OVSR K 7 A_NoBlocking;
		OVSR LMN 7;
		OVSR O -1;
		Stop;
	}
}
class OverseerLance : Actor
{
	Default { +NOBLOCKMAP; +NOGRAVITY; +ZDOOMTRANS; RenderStyle "Add"; Alpha 0.9; Scale 0.6; }
	States
	{
	Spawn:
		FIRE A 2 Bright A_StartFire;
		FIRE BAB 2 Bright A_Fire;
		FIRE C 2 Bright A_FireCrackle;
		FIRE BCBCDCDCDEDED 2 Bright A_Fire;
		FIRE E 2 Bright A_FireCrackle;
		FIRE FEFEFGHGHGH 2 Bright A_Fire;
		Stop;
	}
}

// ---------------------------------------------------------------- Hive Mind (boss, MAP06)
// Shielded until the virus upload completes (objective args[0], default 1).
// Spawns Greys and Probes around itself, fires beam salvos; its death lowers
// tag 666 (the exit barrier) and completes objective args[1] (default 2).
class HiveMind : CCAMonster
{
	int spawnTimer;
	int conduitsLeft;
	Default
	{
		Health 4000; Radius 96; Height 160; Speed 0; PainChance 20; Mass 100000;
		+BOSS +NOTARGET +DONTMORPH +NORADIUSDMG +NOBLOOD +DONTTHRUST +INVULNERABLE +NEVERRESPAWN
		-COUNTKILL
		SeeSound "hive/sight"; PainSound "hive/pain"; DeathSound "hive/death"; ActiveSound "hive/active";
		Obituary "$C51_OB_HIVE";
		Tag "$C51_TAG_HIVE";
		Scale 0.5;
	}
	override void PostBeginPlay()
	{
		Super.PostBeginPlay();
		spawnTimer = 175;
	}
	override void Tick()
	{
		Super.Tick();
		if (isFrozen() || health <= 0) return;
		let ev = CCAEvents.Get();
		int shieldObj = args[0] > 0 ? args[0] : 1;
		if (bInvulnerable && ev && ev.IsDone(shieldObj))
		{
			bInvulnerable = false;
			A_StartSound("hive/shielddown", CHAN_VOICE, 0, 1, ATTN_NONE);
			if (ev) ev.Say("IRIS_HIVE_SHIELD");
		}
		if (target && --spawnTimer <= 0)
		{
			spawnTimer = bInvulnerable ? 280 : 210;
			SpawnMinion();
		}
	}
	void SpawnMinion()
	{
		for (int tries = 0; tries < 8; tries++)
		{
			double a = frandom(0, 360), d = frandom(radius + 96, radius + 320);
			Vector3 p = (pos.xy + AngleToVector(a, d), pos.z);
			class<Actor> t = random(0, 3) == 0 ? "Probe" : "Grey";
			let m = Spawn(t, p, ALLOW_REPLACE);
			if (!m) continue;
			if (!m.TestMobjLocation()) { m.Destroy(); continue; }
			m.SetZ(m.floorz + (t == "Probe" ? 64 : 0));
			m.target = target; m.bFriendly = false;
			m.SetStateLabel("See");
			Spawn("CCATeleportFog", m.pos, ALLOW_REPLACE);
			return;
		}
	}
	States
	{
	Spawn:
		HIVE ABCB 8 Bright A_Look;
		Loop;
	See:
		HIVE ABCB 6 Bright A_Chase(null, "Missile");
		Loop;
	Missile:
		HIVE D 12 Bright A_FaceTarget;
		HIVE E 4 Bright A_SpawnProjectile("ProbePulse", 96, -24, frandom(-6, 6));
		HIVE E 4 Bright A_SpawnProjectile("ProbePulse", 96, 24, frandom(-6, 6));
		HIVE E 4 Bright A_SpawnProjectile("HybridPlasma", 96, 0);
		HIVE D 20 Bright;
		Goto See;
	Pain:
		HIVE F 6 Bright A_Pain;
		Goto See;
	Death:
		HIVE G 10 Bright A_Scream;
		HIVE H 10 Bright A_QuakeEx(6, 6, 4, 140, 0, 4096, "hive/rumble", QF_SCALEDOWN);
		HIVE I 10 Bright;
		HIVE J 10 Bright;
		HIVE K 10
		{
			Level.ExecuteSpecial(21, self, null, false, 666, 16);   // Floor_LowerToLowest tag 666: the exit barrier
			let ev = CCAEvents.Get();
			if (ev) { ev.Complete(args[1] > 0 ? args[1] : 2); ev.Say("IRIS_HIVE_DEAD"); }
		}
		HIVE L -1;
		Stop;
	}
}

// ---------------------------------------------------------------- fx shared by monsters
class OilPuddle : Actor
{
	Default { +NOBLOCKMAP; +NOINTERACTION; +FLATSPRITE; Scale 0.6; RenderStyle "Translucent"; Alpha 0.85; }
	States { Spawn: OILB C -1; Stop; }
}
class CCASparkBlood : Actor
{
	Default { +NOBLOCKMAP; +NOGRAVITY; RenderStyle "Add"; Scale 0.4; }
	States { Spawn: SPRK ABCD 3 Bright; Stop; }
}
class CCATeleportFog : Actor
{
	Default { +NOBLOCKMAP; +NOGRAVITY; +NOINTERACTION; RenderStyle "Add"; Scale 0.6; }
	States
	{
	Spawn:
		TNT1 A 0 NoDelay A_StartSound("world/warpin", CHAN_BODY);
		TELF ABCDEF 4 Bright;
		Stop;
	}
}

class CCAGreenBlood : Blood
{
	Default { RenderStyle "Add"; Alpha 0.85; Scale 0.5; }
	States { Spawn: BLDG ABC 6; Stop; Spray: BLDG ABC 6; Stop; }
}
class CCAOilBlood : Blood
{
	Default { Scale 0.5; }
	States { Spawn: OILB ABC 6; Stop; Spray: OILB ABC 6; Stop; }
}
class CCARedBlood : Blood
{
	Default { Scale 0.5; }
	States { Spawn: BLDR ABC 6; Stop; Spray: BLDR ABC 6; Stop; }
}
