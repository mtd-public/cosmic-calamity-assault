// Screenshot tour (tools/gz-tour.sh sets cca_tour 1): visits the map's
// interesting points (objectives, IRIS beats, terminals, a sample of each
// monster type), stands a few metres back facing each, and takes a
// screenshot. Map-agnostic, so every map gets WIP shots for free.
class CCATour : EventHandler
{
	int t, idx;
	Array<Actor> pts;
	bool built;

	override void WorldTick()
	{
		let cv = CVar.FindCVar("cca_tour");
		if (!cv || cv.GetInt() == 0) return;
		let p = players[consoleplayer].mo;
		if (!p) return;
		t++;
		if (!built && t == 10) { Build(); built = true; p.bNoTarget = true; }
		if (!built) return;
		int slot = t - 20;
		if (slot < 0) return;
		int k = slot / 45, ph = slot % 45;
		int npts = min(pts.Size(), cv.GetInt() * 12);
		if (k < npts)
		{
			if (ph == 0) Visit(p, pts[k]);
			if (ph == 30) Level.MakeScreenShot();
			return;
		}
		// weapon showcase: every gun whose art exists, hip / ADS / dual
		int wk = (slot - npts * 45) / 30, wph = (slot - npts * 45) % 30;
		static const Name guns[] = { 'CCA_Pistol', 'CCA_Shotgun', 'CCA_SMG', 'CCA_AssaultRifle', 'CCA_BattleRifle', 'CCA_Knife', 'CCA_Stinger', 'CCA_Scatter', 'CCA_PlasmaSMG', 'CCA_HarvesterBlade', 'CCA_Singularity' };
		int gi = wk / 3, mode = wk % 3;
		if (gi >= guns.Size()) { if (wph == 0 && gi == guns.Size() && mode == 0) Console.Printf("CCA-TOUR DONE %d", npts); return; }
		if (wph == 0) Showcase(p, guns[gi], mode);
		if (wph == 20)
		{
			let w = CCAWeapon(p.FindInventory(guns[gi]));
			if (w && p.player.ReadyWeapon == w && (mode == 0 || (mode == 1 && w.adsZoom > 0) || (mode == 2 && w.canDual))) Level.MakeScreenShot();
		}
	}

	void Showcase(Actor p, Name gun, int mode)
	{
		let pl = p.player;
		p.A_GiveInventory(gun, 1);
		let w = CCAWeapon(p.FindInventory(gun));
		if (!w) return;
		if (pl.ReadyWeapon != w)
		{
			// switch instantly
			if (pl.ReadyWeapon) { let ow = CCAWeapon(pl.ReadyWeapon); if (ow) { ow.WantDual(false); ow.ClearOverlays(p); } }
			pl.ReadyWeapon = w; pl.PendingWeapon = WP_NOCHANGE;
			pl.SetPSprite(PSP_WEAPON, w.GetReadyState());
			let ps = pl.GetPSprite(PSP_WEAPON); if (ps) { ps.y = WEAPONTOP; ps.x = 0; }
		}
		w.holdADS = (mode == 1);
		if (mode == 1 && w.adsZoom > 0) { w.SetADS(p, true); pl.SetPSprite(PSP_WEAPON, w.FindState("ADSReady")); }
		if (mode == 2 && w.canDual) { if (w.ads) w.SetADS(p, false); pl.SetPSprite(PSP_WEAPON, w.GetReadyState()); p.A_GiveInventory(gun, 1); w.WantDual(true); }
	}

	void Build()
	{
		pts.Clear();
		static const Name kinds[] = { 'ObjectiveMarker', 'HackTerminal', 'IrisTrigger', 'Grey', 'Thrall', 'Scientist', 'DownedGuard', 'Hybrid', 'Probe', 'CCAStalker', 'Overseer', 'HiveMind', 'Curtain', 'RandomFire', 'PropTank', 'PropAttackCraft' };
		for (int i = 0; i < kinds.Size(); i++)
		{
			let it = ThinkerIterator.Create(kinds[i]);
			Actor a; int n = 0;
			int cap = (kinds[i] == 'ObjectiveMarker' || kinds[i] == 'IrisTrigger') ? 6 : 1;
			while ((a = Actor(it.Next())) != null && n < cap) { pts.Push(a); n++; }
		}
	}

	void Visit(Actor p, Actor target)
	{
		if (!target) return;
		// stand 3-5 m away on a free spot, facing the target
		for (int ring = 0; ring < 3; ring++)
		{
			double d = 112 + ring * 48;
			for (int a = 0; a < 360; a += 30)
			{
				Vector2 xy = target.pos.xy + (cos(a) * d, sin(a) * d);
				Sector s = Level.PointInSector(xy);
				double fz = s.floorplane.ZAtPoint(xy);
				Vector3 old = p.pos;
				p.SetOrigin((xy, fz), false);
				if (p.TestMobjLocation() && p.CheckSight(target, SF_IGNOREVISIBILITY))
				{
					Vector2 dv = target.pos.xy - xy;
					p.angle = atan2(dv.y, dv.x);
					double dz = (target.pos.z + target.height * 0.5) - (fz + p.player.viewheight);
					p.pitch = -atan2(dz, dv.Length());
					p.Vel = (0, 0, 0);
					p.player.vel = (0, 0);
					return;
				}
				p.SetOrigin(old, false);
			}
		}
	}
}
