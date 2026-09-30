// Special Agent Eli Marsh. Flashlight (a real spotlight), dolphin dive
// (hold crouch in the air), grenade cooking (+user1), quick melee (+user2).

class CCAPlayer : PlayerPawn
{
	// flashlight: drains while on, recharges while off (batteries top it up)
	bool flashOn;
	double battery;
	// dolphin dive: 0 none, 1 airborne, 2 prone slide, 3 getting up
	int diveState, diveTics;
	double diveView;
	// grenades: 0 frag, 1 alien detonator
	int grenType;
	bool cooking;
	int cookTics;
	// quick melee
	int meleeTics;
	// clamber (mantle): 0 none, >0 tics left
	int climbTics;
	Vector3 climbFrom, climbTo;

	const DIVE_IMPULSE = 9.0;      // forward speed added: clears ~5 m of floor with the jump arc
	const DIVE_MINSPEED = 3.0;     // must be moving to dive
	const DIVE_SLIDE = 18;         // prone slide after landing (0.5 s)
	const DIVE_RECOVER = 12;       // getting up
	const FRAG_FUSE = 140;         // 4 s: cooking past this explodes in hand
	const FLASH_DRAIN = 0.35 / 35; // % per tic: ~5 min of light from full
	const FLASH_CHARGE = 0.9 / 35;
	const CLIMB_MIN = 20;          // ledge height above the feet: mid-body ...
	const CLIMB_MAX = 64;          // ... to just over eye level (with the jump)
	const CLIMB_TICS = 9;          // a quarter second haul-up

	Default
	{
		Player.DisplayName "Marsh";
		Player.SoundClass "marsh";
		Player.StartItem "CCA_Pistol";   // the first weapon listed is the one you start holding
		Player.StartItem "CCA_Knife";
		Player.StartItem "Ammo9mm", 45;
		Player.StartItem "FragGrenades", 2;
		Player.WeaponSlot 1, "CCA_Knife", "CCA_HarvesterBlade";
		Player.WeaponSlot 2, "CCA_Pistol", "CCA_Stinger";
		Player.WeaponSlot 3, "CCA_Shotgun", "CCA_Scatter";
		Player.WeaponSlot 4, "CCA_SMG", "CCA_PlasmaSMG";
		Player.WeaponSlot 5, "CCA_AssaultRifle";
		Player.WeaponSlot 6, "CCA_BattleRifle";
		Player.WeaponSlot 7, "CCA_Singularity";
		Player.ViewHeight 41;
		Player.AttackZOffset 13;   // shots leave at eye height (28 + 13 = 41): they go where the reticle is
		Player.JumpZ 8;
		Player.ViewBob 0.8;
		Player.MaxHealth 100;
		Player.ColorRange 112, 127;
		Health 100;
		Radius 16;
		Height 56;
		Mass 100;
		Speed 1;
		PainChance 255;
	}

	override void PostBeginPlay()
	{
		Super.PostBeginPlay();
		battery = 100;
	}

	override void Tick()
	{
		Super.Tick();
		if (!player || player.mo != self || health <= 0) return;
		TickFlashlight();
		if (TickClimb()) return;
		TickDive();
		TickGrenade();
		TickQuickMelee();
	}

	// ------------------------------------------------------------------ flashlight
	void ToggleFlashlight()
	{
		if (!flashOn && battery < 2) { A_StartSound("items/flashempty", CHAN_AUTO); return; }
		flashOn = !flashOn;
		A_StartSound("items/flashclick", CHAN_AUTO);
		UpdateFlashLight();
	}
	void UpdateFlashLight()
	{
		if (flashOn)
		{
			// spotp out of range → the spot follows our pitch as well as our angle
			A_AttachLight('cca_flash', DynamicLight.PointLight, Color(255, 244, 222), 640, 0,
				DynamicLight.LF_SPOT | DynamicLight.LF_ATTENUATE, (0, 0, player.viewheight - 6), 0, 12, 28, 1000);
			A_AttachLight('cca_flashfill', DynamicLight.PointLight, Color(70, 66, 60), 96, 0,
				DynamicLight.LF_ATTENUATE, (0, 0, player.viewheight - 8));
		}
		else
		{
			A_RemoveLight('cca_flash');
			A_RemoveLight('cca_flashfill');
		}
	}
	void TickFlashlight()
	{
		if (flashOn)
		{
			battery -= FLASH_DRAIN;
			if (battery <= 0) { battery = 0; flashOn = false; UpdateFlashLight(); A_StartSound("items/flashempty", CHAN_AUTO); }
			else if ((Level.maptime % 8) == 0) UpdateFlashLight();   // keep the offset at crouch/dive height
		}
		else battery = min(100, battery + FLASH_CHARGE);
	}

	// ------------------------------------------------------------------ dual wield / grenade type
	void ToggleDual()
	{
		let w = CCAWeapon(player.ReadyWeapon);
		if (!w) return;
		if (!w.hasPair) { A_Print("$C51_MSG_NEEDPAIR"); return; }
		w.WantDual(!w.dual);
	}
	void CycleGrenade()
	{
		grenType = 1 - grenType;
		if (CountInv(grenType == 0 ? "FragGrenades" : "AlienDetonators") == 0) grenType = 1 - grenType;
		A_StartSound("items/switchgren", CHAN_AUTO);
	}

	// ------------------------------------------------------------------ clamber
	// In the air, press jump again facing a ledge between mid-body and eye
	// level (or a window sill / a gap's far edge): haul yourself up onto it.
	bool TickClimb()
	{
		if (climbTics > 0)
		{
			climbTics--;
			double k = 1.0 - double(climbTics) / CLIMB_TICS;
			// up first, then over the lip
			double kz = min(1.0, k * 1.6), kxy = max(0.0, (k - 0.35) / 0.65);
			Vector3 p = (climbFrom.xy + (climbTo.xy - climbFrom.xy) * kxy, climbFrom.z + (climbTo.z - climbFrom.z) * kz);
			SetOrigin(p, true);
			Vel = (0, 0, 0);
			if (climbTics == 0) { Vel.XY = AngleToVector(angle, 2); player.jumptics = 8; }
			return true;
		}
		bool jumpPressed = (player.cmd.buttons & BT_JUMP) && !(player.oldbuttons & BT_JUMP);
		if (!jumpPressed || player.onground || diveState != 0 || pos.z - floorz < 4) return false;
		// probe just past our front edge, at a few distances (thin walls, gaps)
		for (double d = radius + 8; d <= radius + 40; d += 16)
		{
			Vector2 xy = pos.xy + AngleToVector(angle, d);
			Sector sec = Level.PointInSector(xy);
			double ledge; Sector s2; F3DFloor ff;
			[ledge, s2, ff] = sec.NextLowestFloorAt(xy.x, xy.y, pos.z + CLIMB_MAX + 1);
			double rise = ledge - pos.z;
			if (rise < CLIMB_MIN || rise > CLIMB_MAX) continue;
			double ceil; Sector s3; F3DFloor f3;
			[ceil, s3, f3] = sec.NextHighestCeilingAt(xy.x, xy.y, ledge + 1, ledge + height);
			if (ceil - ledge < height) continue;              // no room to stand
			Vector3 dest = (xy + AngleToVector(angle, 8), ledge);
			climbFrom = pos; climbTo = dest; climbTics = CLIMB_TICS;
			A_StartSound("player/clamber", CHAN_BODY);
			A_QuakeEx(0, 0, 1, 6, 0, 32, "", QF_RELATIVE | QF_SCALEDOWN);
			return true;
		}
		return false;
	}

	// ------------------------------------------------------------------ dolphin dive
	// Jump, then hold crouch while moving: a forward dive, prone on landing.
	// Weapons keep working the whole time.
	void TickDive()
	{
		bool crouchHeld = (player.cmd.buttons & BT_CROUCH) != 0;
		bool airborne = !player.onground && pos.z - floorz > 6;
		double hspeed = Vel.XY.Length();
		switch (diveState)
		{
		case 0:
			if (airborne && crouchHeld && hspeed > DIVE_MINSPEED && Vel.Z > -6)
			{
				Vector2 dir = Vel.XY.Unit();
				Vel.XY += dir * DIVE_IMPULSE;
				Vel.Z = max(Vel.Z, 2.5);
				diveState = 1;
				A_StartSound("player/dive", CHAN_BODY);
			}
			break;
		case 1:
			diveView = min(diveView + 3, 16);
			if (player.onground || pos.z <= floorz + 0.5)
			{
				diveState = 2; diveTics = DIVE_SLIDE;
				A_StartSound("player/diveland", CHAN_BODY);
				A_QuakeEx(1, 1, 2, 8, 0, 64, "", QF_RELATIVE | QF_SCALEDOWN);
			}
			break;
		case 2:
			diveView = min(diveView + 2, 22);
			Vel.XY *= 0.86;
			if (--diveTics <= 0) { diveState = 3; diveTics = DIVE_RECOVER; }
			break;
		case 3:
			diveView = max(0, diveView - 22.0 / DIVE_RECOVER);
			if (--diveTics <= 0) { diveState = 0; diveView = 0; }
			break;
		}
		if (diveState == 0 && diveView > 0) diveView = max(0, diveView - 2);
	}
	override void CalcHeight()
	{
		Super.CalcHeight();
		if (diveView > 0) player.viewz = max(floorz + 6, player.viewz - diveView);
	}
	// no jumping out of a prone slide
	override void CheckJump()
	{
		if (diveState >= 2) return;
		Super.CheckJump();
	}

	// ------------------------------------------------------------------ grenades
	// Hold +user1 to cook (the left hand comes up), release to throw. A frag
	// cooked for 4 s goes off in your hand; the alien detonator has no fuse
	// until it sticks.
	void TickGrenade()
	{
		bool held = (player.cmd.buttons & BT_USER1) != 0;
		bool pressed = held && !(player.oldbuttons & BT_USER1);
		class<Inventory> ammo = grenType == 0 ? "FragGrenades" : "AlienDetonators";
		if (!cooking)
		{
			if (pressed && CountInv(ammo) > 0 && meleeTics <= 0)
			{
				cooking = true; cookTics = 0;
				SetHands(6, grenType == 0 ? "GrenCook" : "DetCook");
				A_StartSound(grenType == 0 ? "weapons/grenpin" : "weapons/detarm", CHAN_AUTO);
			}
			return;
		}
		cookTics++;
		if (grenType == 0 && cookTics >= FRAG_FUSE)
		{
			cooking = false;
			A_TakeInventory(ammo, 1);
			player.SetPSprite(6, null);
			let x = Spawn("CCAFragBlast", pos + (0, 0, height * 0.5));
			if (x) x.target = self;
			return;
		}
		if (!held)
		{
			cooking = false;
			A_TakeInventory(ammo, 1);
			SetHands(6, grenType == 0 ? "GrenThrow" : "DetThrow");
			A_StartSound("weapons/grenthrow", CHAN_AUTO);
			class<Actor> pt = grenType == 0 ? "CCAFragThrown" : "CCADetonatorThrown";
			let g = Spawn(pt, pos + (0, 0, player.viewheight - 8) + (AngleToVector(angle, 12), 0));
			if (g)
			{
				g.target = self;
				g.angle = angle;
				double sp = 22;
				g.Vel3DFromAngle(sp, angle, pitch - 8);
				g.Vel += Vel * 0.5;
				let fg = CCAFragThrown(g);
				if (fg) fg.fuse = max(12, FRAG_FUSE - cookTics);
			}
			if (CountInv(ammo) == 0) CycleGrenade();
		}
	}

	// ------------------------------------------------------------------ quick melee (+user2)
	void TickQuickMelee()
	{
		if (meleeTics > 0)
		{
			meleeTics--;
			if (meleeTics == 8)
			{
				FTranslatedLineTarget t;
				int dmg = 3 * random(4, 10);
				LineAttack(angle, 72, pitch, dmg, 'Melee', "CCAKnifePuff", LAF_ISMELEEATTACK, t);
				A_StartSound(t.linetarget ? "weapons/knifehit" : "weapons/knifeswing", CHAN_WEAPON);
			}
			return;
		}
		if ((player.cmd.buttons & BT_USER2) && !(player.oldbuttons & BT_USER2) && !cooking)
		{
			meleeTics = 14;
			SetHands(7, "QuickMelee");
		}
	}

	// A left-hand / overlay animation from CCAHands (no action functions in them).
	void SetHands(int layer, String lbl)
	{
		let def = GetDefaultByType("CCAHands");
		State st = def.FindStateByString(lbl);
		if (st) player.SetPSprite(layer, st);
	}
}

// State container for the overlay hands (grenade, detonator, quick melee,
// flashlight). Never spawned.
class CCAHands : Weapon
{
	States
	{
	GrenCook:
		GRNH A 5;
		GRNH B -1;
		Stop;
	GrenThrow:
		GRNH C 2;
		GRNH D 2;
		GRNH E 3;
		Stop;
	DetCook:
		DETH A 4 Bright;
		DETH B -1 Bright;
		Stop;
	DetThrow:
		DETH C 2;
		DETH D 2;
		DETH E 3;
		Stop;
	QuickMelee:
		MELE A 3;
		MELE B 3;
		MELE C 4;
		MELE D 4;
		Stop;
	FlashOn:
		FLHL A -1;
		Stop;
	FlashOff:
		FLHL B -1;
		Stop;
	}
}
