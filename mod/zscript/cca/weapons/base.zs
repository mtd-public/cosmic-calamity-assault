// CCAWeapon: Call of Duty handling on Doom weapons.
//  - hip: one-handed, off to the right (the sprites are drawn that way)
//  - ADS: hold +altattack; the gun comes to the centre, FOV zooms, spread tightens
//  - dual wield: with a second copy (hasPair), toggle; the left gun is the
//    same frames mirrored on overlay LAYER_LEFT; +attack fires right, +altattack left
//  - magazines per gun; reserve = AmmoType1; R reloads, and X/use reloads too
//    unless you are looking at something usable
//  - shots follow the view exactly (LineAttack at the player's pitch; no autoaim)
//
// Subclass state labels: Ready Fire Flash ADSIn ADSReady ADSFire ADSFlash ADSOut
// Reload (+ ReloadLoop/ReloadEnd for shell weapons, Vent for heat weapons)
// LeftReady LeftFire LeftFlash LeftReload, Select Deselect Spawn.

class CCAWeapon : Weapon abstract
{
	const LAYER_LEFT = 2;
	const LAYER_LFLASH = 3;
	const LAYER_FLASHHAND = -2;   // behind the gun

	// ---------------------------------------------------------------- tuning (properties)
	int magSize;            property MagSize: magSize;            // 0 = no magazine (melee / heat / charge)
	int dmgN, dmgA, dmgB;   property Damage: dmgN, dmgA, dmgB;     // Doom-style N * random(a, b)
	int pellets;            property Pellets: pellets;
	double spreadHip;       property SpreadHip: spreadHip;        // degrees
	double spreadAds;       property SpreadADS: spreadAds;
	double adsZoom;         property ADSZoom: adsZoom;            // 0 = no ADS (melee, Singularity)
	double kick;            property Kick: kick;                  // recoil pitch kick, degrees
	class<Actor> proj;      property Projectile: proj;            // null = hitscan
	class<Actor> puffType;  property Puff: puffType;
	sound fireSound;        property FireSound: fireSound;
	int semiAuto;           property SemiAuto: semiAuto;          // 1 = one shot per press
	int heatPerShot;        property HeatPerShot: heatPerShot;    // heat weapons (no magazine)
	int ammoPerShot;        property AmmoPerShot: ammoPerShot;    // for magazine-less guns
	class<Actor> casing;    property Casing: casing;
	int reticle;            property Reticle: reticle;            // HUD reticle shape
	int canDual;            property CanDual: canDual;

	// ---------------------------------------------------------------- runtime
	int mag, magL;
	bool hasPair, dual, ads;
	bool holdADS;           // test hook (tour screenshots): behave as if ADS is held
	double bloom;           // extra spread from sustained fire, decays
	double heat;            // 0..100
	bool venting;
	int lastShotTic;

	Default
	{
		Weapon.AmmoUse1 0;             // magazines are ours; the engine never consumes directly
		Weapon.BobStyle "InverseSmooth";
		Weapon.BobRangeX 0.6;
		Weapon.BobRangeY 0.5;
		Weapon.BobSpeed 1.6;
		Weapon.UpSound "weapons/raise";
		CCAWeapon.Pellets 1;
		CCAWeapon.SpreadHip 2.0;
		CCAWeapon.SpreadADS 0.3;
		CCAWeapon.ADSZoom 1.35;
		CCAWeapon.Kick 1.0;
		CCAWeapon.Puff "CCABulletPuff";
		CCAWeapon.CanDual 1;
		CCAWeapon.AmmoPerShot 1;
		+WEAPON.NOAUTOFIRE
		+WEAPON.NOALERT
		+WEAPON.AMMO_OPTIONAL
		+WEAPON.NOAUTOAIM
		Inventory.PickupSound "items/weapon";
	}

	// ---------------------------------------------------------------- inventory
	override void AttachToOwner(Actor other)
	{
		Super.AttachToOwner(other);
		mag = magSize;
	}
	override bool HandlePickup(Inventory item)
	{
		if (item.GetClass() == GetClass() && canDual && !hasPair)
		{
			hasPair = true;
			magL = magSize;
			if (Owner) Owner.A_Print("$C51_MSG_GOTPAIR");
		}
		return Super.HandlePickup(item);
	}
	override void DoEffect()
	{
		Super.DoEffect();
		bloom = max(0, bloom - 0.08);
		if (heatPerShot > 0 && Level.maptime - lastShotTic > 6 && !venting) heat = max(0, heat - 1.4);
	}

	clearscope int Reserve() const { return Ammo1 ? Ammo1.Amount : 0; }

	clearscope bool HasRound(bool left) const
	{
		if (magSize > 0) return (left ? magL : mag) > 0;
		if (heatPerShot > 0 && venting) return false;
		if (!Ammo1) return true;                       // melee
		return Ammo1.Amount >= ammoPerShot;
	}
	bool TakeRound(bool left)
	{
		if (!HasRound(left)) return false;
		if (magSize > 0) { if (left) magL--; else mag--; }
		else if (Ammo1) Ammo1.Amount -= ammoPerShot;
		if (heatPerShot > 0) heat = min(100, heat + heatPerShot);
		lastShotTic = Level.maptime;
		return true;
	}
	clearscope bool CanReload(bool left) const
	{
		if (magSize <= 0 || Reserve() <= 0) return false;
		return (left ? magL : mag) < magSize;
	}
	void FillMag(bool left)
	{
		int need = magSize - (left ? magL : mag);
		int take = min(need, Reserve());
		if (take <= 0) return;
		Ammo1.Amount -= take;
		if (left) magL += take; else mag += take;
	}

	// Spread in degrees right now (also drives the HUD reticle).
	clearscope double SpreadNow(Actor mo) const
	{
		double s = ads ? spreadAds : spreadHip;
		s += bloom * (ads ? 0.35 : 1.0);
		if (mo && !ads) s += min(mo.Vel.XY.Length() * 0.12, 1.5);
		if (mo && mo.player && !mo.player.onground) s += 0.8;
		if (dual) s *= 1.3;
		return s;
	}

	void SetADS(Actor mo, bool on)
	{
		ads = on;
		FOVScale = on ? 1.0 / adsZoom : 1.0;
		if (mo) mo.Speed = on ? 0.6 : 1.0;             // aiming slows you (CoD)
		if (mo) mo.A_StartSound(on ? "weapons/adsin" : "weapons/adsout", CHAN_AUTO, 0, 0.5);
	}

	void WantDual(bool on)
	{
		if (on && !hasPair) return;
		dual = on;
		if (Owner)
		{
			if (on && ads) SetADS(Owner, false);
			Owner.A_StartSound("weapons/raise", CHAN_AUTO);
			Owner.A_Print(on ? "$C51_MSG_DUALON" : "$C51_MSG_DUALOFF");
		}
	}

	// R reloads; X/use reloads unless you're looking at a door, switch,
	// terminal or downed guard (one controller button does both, like CoD).
	bool WantsReload(Actor mo, int btn, int old)
	{
		if ((btn & BT_RELOAD) && !(old & BT_RELOAD)) return true;
		if (!((btn & BT_USE) && !(old & BT_USE))) return false;
		FLineTraceData d;
		if (mo.LineTrace(mo.angle, 80, mo.pitch, TRF_ALLACTORS, mo.player.viewheight, 0, 0, d))
		{
			if (d.HitType == TRACE_HitWall && d.HitLine && d.HitLine.special && (d.HitLine.activation & SPAC_Use)) return false;
			if (d.HitType == TRACE_HitActor && d.HitActor && (d.HitActor is "DownedGuard" || d.HitActor is "HackTerminal" || d.HitActor is "CCANPC")) return false;
		}
		// a seated guard or a low terminal sits under the eye-level trace: look around the feet too
		let it = BlockThingsIterator.Create(mo, 96);
		while (it.Next())
		{
			let a = it.thing;
			if (!a || !(a is "DownedGuard" || a is "HackTerminal" || a is "CCANPC") || a.health <= 0) continue;
			if (mo.Distance2D(a) > 96) continue;
			if (abs(DeltaAngle(mo.angle, mo.AngleTo(a))) < 40) return false;
		}
		return true;
	}

	// Hitscan with exact pitch, or projectiles along the view; spread in a cone.
	void ShootRounds(Actor mo, bool left)
	{
		double sp = SpreadNow(mo);
		int n = max(1, pellets);
		for (int i = 0; i < n; i++)
		{
			double r = sp * sqrt(frandom(0, 1));
			double th = frandom(0, 360);
			double a = mo.angle + r * cos(th);
			double p = mo.pitch + r * sin(th) * 0.8;
			if (proj)
			{
				Actor m1, m2;
				[m1, m2] = mo.SpawnPlayerMissile(proj, a, 0, 0, 0, null, false, true);
				if (m2) m2.Vel3DFromAngle(m2.Speed, a, p);
			}
			else
			{
				int dmg = dmgN * random(dmgA, dmgB);
				mo.LineAttack(a, 8192, p, dmg, 'Hitscan', puffType, 0, null, 0, 0, left ? -5 : 5);
			}
		}
	}

	// ---------------------------------------------------------------- overlays
	void SyncOverlays(Actor mo)
	{
		let p = mo.player;
		if (!p) return;
		let psl = p.FindPSprite(LAYER_LEFT);
		if (dual && !psl)
		{
			State st = FindState("LeftReady");
			if (st)
			{
				p.SetPSprite(LAYER_LEFT, st);
				let ps = p.FindPSprite(LAYER_LEFT);
				if (ps) { ps.bMirror = true; ps.bAddWeapon = true; ps.bAddBob = true; }
			}
		}
		else if (!dual && psl) p.SetPSprite(LAYER_LEFT, null);

		let cp = CCAPlayer(mo);
		bool showHand = cp && cp.flashOn && !dual && !ads && !cp.cooking && cp.meleeTics <= 0;
		let psf = p.FindPSprite(LAYER_FLASHHAND);
		if (showHand && !psf)
		{
			cp.SetHands(LAYER_FLASHHAND, "FlashOn");
			let ps = p.FindPSprite(LAYER_FLASHHAND);
			if (ps) { ps.bAddWeapon = true; ps.bAddBob = true; }
		}
		else if (!showHand && psf) p.SetPSprite(LAYER_FLASHHAND, null);
	}
	void ClearOverlays(Actor mo)
	{
		let p = mo.player;
		if (!p) return;
		p.SetPSprite(LAYER_LEFT, null);
		p.SetPSprite(LAYER_LFLASH, null);
		p.SetPSprite(LAYER_FLASHHAND, null);
		if (ads) SetADS(mo, false);
	}

	// ---------------------------------------------------------------- state actions
	action void CCA_Ready()
	{
		let w = invoker;
		if (!player) return;
		int btn = player.cmd.buttons, old = player.oldbuttons;
		w.SyncOverlays(self);
		A_WeaponReady(WRF_NOFIRE | (w.ads ? WRF_NOBOB : 0));
		if (player.ReadyWeapon != w || player.PendingWeapon != WP_NOCHANGE) return;

		// ADS (hold); melee weapons use alt-fire for their heavy attack instead
		if (!w.dual && w.adsZoom > 0)
		{
			bool want = (btn & BT_ALTATTACK) != 0 || w.holdADS;
			if (want && !w.ads) { w.SetADS(self, true); player.SetPSprite(PSP_WEAPON, w.FindState("ADSIn")); return; }
			if (!want && w.ads) { w.SetADS(self, false); player.SetPSprite(PSP_WEAPON, w.FindState("ADSOut")); return; }
		}
		else if (w.adsZoom <= 0 && (btn & BT_ALTATTACK) && !(old & BT_ALTATTACK))
		{
			State alt = w.FindState("AltFire");
			if (alt) { player.SetPSprite(PSP_WEAPON, alt); return; }
		}

		// reload both guns at once when dual (CoD akimbo)
		if (w.WantsReload(self, btn, old) && (w.CanReload(false) || (w.dual && w.CanReload(true))))
		{
			if (w.ads) w.SetADS(self, false);
			if (w.dual && w.CanReload(true)) player.SetPSprite(LAYER_LEFT, w.FindState("LeftReload"));
			if (w.CanReload(false)) { player.SetPSprite(PSP_WEAPON, w.FindState("Reload")); return; }
		}

		bool pressed = (btn & BT_ATTACK) && !(old & BT_ATTACK);
		bool trig = w.semiAuto ? pressed : (btn & BT_ATTACK) != 0;
		if (trig)
		{
			if (w.HasRound(false)) { player.SetPSprite(PSP_WEAPON, w.ads ? w.FindState("ADSFire") : w.FindState("Fire")); return; }
			if (pressed)
			{
				A_StartSound("weapons/dryfire", CHAN_WEAPON);
				if (w.CanReload(false)) { if (w.ads) w.SetADS(self, false); player.SetPSprite(PSP_WEAPON, w.FindState("Reload")); }
			}
		}
	}

	action void CCA_Fire(bool left = false)
	{
		let w = invoker;
		if (!player || !w.TakeRound(left)) return;
		w.ShootRounds(self, left);
		if (left)
		{
			State fs = w.FindState("LeftFlash");
			if (fs)
			{
				player.SetPSprite(LAYER_LFLASH, fs);
				let ps = player.FindPSprite(LAYER_LFLASH);
				if (ps) { ps.bMirror = true; ps.bAddWeapon = true; ps.bAddBob = true; }
				A_OverlayRenderStyle(LAYER_LFLASH, STYLE_Add);
			}
		}
		else
		{
			State fs = w.ads ? w.FindState("ADSFlash") : w.FindState("Flash");
			if (fs) { player.SetPSprite(PSP_FLASH, fs, true); A_OverlayRenderStyle(PSP_FLASH, STYLE_Add); }
		}
		A_StartSound(w.fireSound, left ? CHAN_7 : CHAN_WEAPON);
		A_AlertMonsters();
		double k = w.kick * (w.ads ? 0.55 : 1.0) * (w.dual ? 0.8 : 1.0);
		A_SetPitch(pitch - k * frandom(0.8, 1.2), SPF_INTERPOLATE);
		A_SetAngle(angle + frandom(-k, k) * 0.3, SPF_INTERPOLATE);
		w.bloom = min(w.bloom + 0.4, 3.5);
		if (w.casing)
		{
			let c = Spawn(w.casing, pos + (0, 0, player.viewheight - 10) + (AngleToVector(angle + (left ? 60 : -60), 10), 0));
			if (c) { c.Vel3DFromAngle(frandom(3, 5), angle + (left ? 100 : -100) + frandom(-15, 15), frandom(-50, -30)); c.Vel += Vel; }
		}
		if (player.mo) player.mo.PlayAttacking2();
	}

	action void CCA_LeftReady()
	{
		let w = invoker;
		if (!player) return;
		if (!w.dual) { player.SetPSprite(LAYER_LEFT, null); return; }
		int btn = player.cmd.buttons, old = player.oldbuttons;
		bool pressed = (btn & BT_ALTATTACK) && !(old & BT_ALTATTACK);
		bool trig = w.semiAuto ? pressed : (btn & BT_ALTATTACK) != 0;
		if (trig)
		{
			if (w.HasRound(true)) { player.SetPSprite(LAYER_LEFT, w.FindState("LeftFire")); return; }
			if (pressed)
			{
				A_StartSound("weapons/dryfire", CHAN_7);
				if (w.CanReload(true)) player.SetPSprite(LAYER_LEFT, w.FindState("LeftReload"));
			}
		}
	}
	action void CCA_LeftFire() { CCA_Fire(true); }

	action void CCA_ReloadStart() { A_StartSound("weapons/magout", CHAN_WEAPON); }
	action void CCA_ReloadFill()  { invoker.FillMag(false); A_StartSound("weapons/magin", CHAN_WEAPON); }
	action void CCA_LeftFill()    { invoker.FillMag(true); A_StartSound("weapons/magin", CHAN_7); }
	action void CCA_Rack()        { A_StartSound("weapons/rack", CHAN_WEAPON); }

	// shell-by-shell: one shell per call; firing interrupts the loop
	action void CCA_InsertShell(bool left = false)
	{
		let w = invoker;
		if (w.Reserve() <= 0) return;
		if (left ? w.magL >= w.magSize : w.mag >= w.magSize) return;
		w.Ammo1.Amount--;
		if (left) w.magL++; else w.mag++;
		A_StartSound("weapons/shellin", left ? CHAN_7 : CHAN_WEAPON);
	}
	action state CCA_ShellCheck(statelabel done, bool left = false)
	{
		let w = invoker;
		bool full = left ? w.magL >= w.magSize : w.mag >= w.magSize;
		int fireBtn = left ? BT_ALTATTACK : BT_ATTACK;
		if (full || w.Reserve() <= 0 || (player && (player.cmd.buttons & fireBtn) && (left ? w.magL : w.mag) > 0))
			return ResolveState(done);
		return null;
	}

	// heat weapons: after a shot, vent if hot
	action state CCA_HeatCheck()
	{
		let w = invoker;
		if (w.heat >= 100) { w.venting = true; if (w.ads) w.SetADS(self, false); A_StartSound("weapons/vent", CHAN_WEAPON); return ResolveState("Vent"); }
		return null;
	}
	action void CCA_VentDone() { invoker.venting = false; invoker.heat = 0; }

	// melee: a short LineAttack; the lunge variant thrusts the player forward
	action void CCA_Melee(double range, int n, int a, int b, bool lunge = false)
	{
		if (lunge) A_ChangeVelocity(9, 0, 0, CVF_RELATIVE);
		FTranslatedLineTarget t;
		LineAttack(angle, range, pitch, n * random(a, b), 'Melee', "CCAKnifePuff", LAF_ISMELEEATTACK, t);
		if (t.linetarget)
		{
			A_StartSound(invoker is "CCA_HarvesterBlade" ? "weapons/bladehit" : "weapons/knifehit", CHAN_WEAPON);
			angle = t.angleFromSource;
		}
		else A_StartSound(invoker is "CCA_HarvesterBlade" ? "weapons/bladeswing" : "weapons/knifeswing", CHAN_WEAPON);
	}

	action void CCA_Deselect()
	{
		invoker.ClearOverlays(self);
		A_Lower(12);
	}
	action void CCA_Select()
	{
		A_Raise(12);
	}
}

// ---------------------------------------------------------------- puffs / casings
class CCABulletPuff : BulletPuff
{
	Default { +NOEXTREMEDEATH; +PUFFGETSOWNER; VSpeed 0.4; Scale 0.5; RenderStyle "Add"; Alpha 0.9; }
	States
	{
	Spawn:
		PUFF A 2 Bright;
		PUFF B 2 Bright;
	Melee:
		PUFF C 3;
		PUFF D 3;
		Stop;
	}
}
class CCAKnifePuff : CCABulletPuff
{
	Default { AttackSound "weapons/knifewall"; +PUFFONACTORS; }
	States
	{
	Spawn:
	Melee:
		SPRK A 2 Bright;
		SPRK B 2 Bright;
		Stop;
	}
}
class CCACasing : Actor
{
	Default { Radius 2; Height 2; Scale 0.5; BounceType "Doom"; BounceFactor 0.4; BounceCount 3; BounceSound "weapons/casing"; +MISSILE; +NOBLOCKMAP; +DROPOFF; +NOTELEPORT; +THRUACTORS; Gravity 0.8; }
	States
	{
	Spawn:
		CASE ABCD 2;
		Loop;
	Death:
		CASE A 105;
		CASE A 1 A_FadeOut(0.05);
		Wait;
	}
}
class CCAShellCasing : CCACasing
{
	Default { BounceSound "weapons/shellcasing"; }
	States
	{
	Spawn:
		SHEL ABCD 2;
		Loop;
	Death:
		SHEL A 105;
		SHEL A 1 A_FadeOut(0.05);
		Wait;
	}
}
