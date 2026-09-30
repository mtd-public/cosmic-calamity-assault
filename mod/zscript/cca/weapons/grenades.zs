// Frag (cooked by holding +user1) and the Predator-style alien detonator,
// thrown from CCAPlayer.TickGrenade.

class CCAFragThrown : Actor
{
	int fuse;   // set by the thrower: 4 s minus the time cooked
	Default
	{
		Radius 3; Height 4; Speed 22; Mass 20;
		Projectile;
		-NOGRAVITY
		+BOUNCEONACTORS
		+CANBOUNCEWATER
		+NOEXPLODEFLOOR
		BounceType "Doom";
		BounceFactor 0.45;
		WallBounceFactor 0.35;
		BounceSound "weapons/grenbounce";
		Gravity 0.7;
		Scale 0.5;
		Obituary "$C51_OB_FRAG";
	}
	override void Tick()
	{
		Super.Tick();
		if (isFrozen()) return;
		if (--fuse <= 0 && !InStateSequence(CurState, ResolveState("Boom"))) SetStateLabel("Boom");
	}
	States
	{
	Spawn:
		FRAG ABCD 3;
		Loop;
	Death:
		FRAG A -1;   // at rest: the fuse (Tick) still runs
		Stop;
	Boom:
		TNT1 A 0 { bNoGravity = true; Vel = (0, 0, 0); A_SetRenderStyle(1, STYLE_Add); A_SetScale(1.0); }
		EXPL A 3 Bright { A_Explode(128, 160, XF_HURTSOURCE); A_StartSound("weapons/explode", CHAN_BODY, 0, 1, 0.6); A_QuakeEx(2, 2, 2, 12, 0, 512, "", QF_SCALEDOWN); A_AlertMonsters(); }
		EXPL BCDEFGH 3 Bright;
		Stop;
	}
}

// A frag cooked too long: goes off where the player stands.
class CCAFragBlast : Actor
{
	Default { +NOBLOCKMAP; +NOGRAVITY; RenderStyle "Add"; Obituary "$C51_OB_FRAGSELF"; }
	States
	{
	Spawn:
		EXPL A 3 Bright { A_Explode(128, 160, XF_HURTSOURCE); A_StartSound("weapons/explode", CHAN_BODY); A_QuakeEx(4, 4, 4, 20, 0, 512, "", QF_SCALEDOWN); }
		EXPL BCDEFGH 3 Bright;
		Stop;
	}
}

// Alien detonator: sticks to whatever it hits (walls, floors, monsters),
// blinks its red glyphs for 3 s, then a big blast.
class CCADetonatorThrown : Actor
{
	Actor stuckTo;
	Vector3 stuckOfs;
	int armTics;
	bool stuck;
	Default
	{
		Radius 3; Height 4; Speed 24; Mass 10;
		Projectile;
		-NOGRAVITY
		Gravity 0.6;
		Scale 0.5;
		Obituary "$C51_OB_DET";
	}
	override int SpecialMissileHit(Actor victim)
	{
		if (victim == target || stuck) return 1;
		if (victim.bShootable)
		{
			stuckTo = victim;
			stuckOfs = pos - victim.pos;
			Stick();
			return 1;
		}
		return -1;
	}
	void Stick()
	{
		if (stuck) return;
		stuck = true;
		bMissile = false; bNoGravity = true; bNoInteraction = true;
		Vel = (0, 0, 0);
		armTics = 105;
		A_StartSound("weapons/detstick", CHAN_BODY);
		SetStateLabel("Armed");
	}
	override void Tick()
	{
		Super.Tick();
		if (isFrozen() || !stuck) return;
		if (stuckTo && stuckTo.health > 0) SetOrigin(stuckTo.pos + stuckOfs, true);
		if (armTics > 0 && --armTics == 0) SetStateLabel("Boom");
		else if (armTics > 0 && (armTics % (armTics > 35 ? 12 : 5)) == 0) A_StartSound("weapons/detbeep", CHAN_VOICE, 0, 0.8);
	}
	States
	{
	Spawn:
		DETN AB 3 Bright;
		Loop;
	Death:
		TNT1 A 0 { Stick(); }
	Armed:
		DETN CD 4 Bright;
		Loop;
	Boom:
		TNT1 A 0 { A_SetRenderStyle(1, STYLE_Add); A_SetScale(1.4); }
		EXPL A 3 Bright { A_Explode(200, 192, XF_HURTSOURCE); A_StartSound("weapons/detboom", CHAN_BODY, 0, 1, 0.5); A_QuakeEx(4, 4, 4, 18, 0, 768, "", QF_SCALEDOWN); A_AlertMonsters(); }
		EXPL BCDEFGH 3 Bright;
		Stop;
	}
}
