// IRIS's HUD (GAME_DESIGN §6). Two parts:
//  - CCAStatusBar (BaseStatusBar): portrait + subtitles, objectives, vitals,
//    ammo, grenades, battery, keys, hack / revive gauges, scope.
//  - CCAOverlay (EventHandler.RenderOverlay): world-projected waypoint and
//    the per-weapon reticle, drawn in real screen pixels with the true view.

class CCAStatusBar : BaseStatusBar
{
	HUDFont fSmall, fBig;
	const HW = 640;
	const HH = 400;
	static const Color SPK_COL[] = { 0xff8cf7a0, 0xffe8d9b0, 0xff9fd3ff, 0xffc9c9c9, 0xffffcf6e, 0xffffffff, 0xffb18cff };
	static const String SPK_NAME[] = { "IRIS", "MARSH", "KADE", "CUSTODIAN", "GUARD", "SCIENTIST", "???" };

	override void Init()
	{
		Super.Init();
		SetSize(0, HW, HH);
		fSmall = HUDFont.Create(NewSmallFont);
		fBig = HUDFont.Create(NewConsoleFont);
	}

	override void Draw(int state, double TicFrac)
	{
		Super.Draw(state, TicFrac);
		if (state == HUD_None || automapactive && state != HUD_AltHud && false) return;
		BeginHUD(1.0, true, HW, HH);
		let ev = CCAEvents.Get();
		let pmo = CCAPlayer(CPlayer.mo);
		DrawScope();
		DrawIris(ev);
		DrawObjectives(ev);
		DrawVitals(pmo);
		DrawAmmo(pmo);
		DrawGauges(ev);
	}

	// ---------------------------------------------------------------- IRIS
	void DrawIris(CCAEvents ev)
	{
		String img = "IRISI0";
		int t = Level.maptime;
		if (ev)
		{
			if (CPlayer.health > 0 && CPlayer.health < 35 && (t % 70) < 8) img = String.Format("IRISG%d", (t / 3) % 3);
			else if (ev.alarmTics > 0) img = String.Format("IRISA%d", (t / 6) % 2);
			else if (ev.talkTics > 0) img = String.Format("IRIST%d", (t / 4) % 4);
			else if ((t % 280) < 30) img = ((t / 280) % 2) ? "IRISL0" : "IRISR0";
			else img = String.Format("IRISI%d", (t / 9) % 4);
		}
		// portrait frame (top-right corner)
		int R = DI_SCREEN_RIGHT_TOP;
		Fill(0x9010161a, -76, 6, 70, 70, R);
		Fill(0xff2b8c4a, -76, 6, 70, 1, R); Fill(0xff2b8c4a, -76, 75, 70, 1, R); Fill(0xff2b8c4a, -76, 6, 1, 70, R); Fill(0xff2b8c4a, -7, 6, 1, 70, R);
		DrawImage(img, (-41, 41), R | DI_ITEM_CENTER, 1.0, (64, 64));
		// subtitle to the left of the portrait
		if (ev && ev.subText.Size() > 0 && ev.subTic > 0)
		{
			int spk = ev.subSpeaker[0];
			String line = ev.subText[0];
			int shown = min(line.CodePointCount(), ev.subTic * 2);   // typewriter
			String part = line.Left(TrimToChars(line, shown));
			Fill(0xa0080c0e, -444, 8, 362, 46, R);
			DrawString(fSmall, SPK_NAME[spk], (-438, 11), R | DI_TEXT_ALIGN_LEFT, Font.CR_UNTRANSLATED, 1.0, -1, 4, (0.8, 0.8));
			Fill(SPK_COL[spk], -438, 22, 30, 1, R);
			DrawString(fSmall, part, (-438, 25), R | DI_TEXT_ALIGN_LEFT, Font.CR_WHITE, 1.0, int(350 / 0.75), 2, (0.75, 0.75));
		}
	}
	// byte length of the first n code points
	int TrimToChars(String s, int n)
	{
		int pos = 0, count = 0;
		while (pos < s.Length() && count < n) { int ch; [ch, pos] = s.GetNextCodePoint(pos); count++; }
		return pos;
	}

	// ---------------------------------------------------------------- objectives
	void DrawObjectives(CCAEvents ev)
	{
		if (!ev || ev.objText.Size() == 0) return;
		double y = 84;
		int R = DI_SCREEN_RIGHT_TOP;
		int cur = ev.CurrentObjective();
		bool flash = Level.maptime - ev.objFlashTic < 70 && (Level.maptime % 10) < 5;
		for (int i = 0; i < ev.objText.Size(); i++)
		{
			bool done = ev.objDone[i];
			bool isCur = (i + 1) == cur;
			if (!done && !isCur) continue;          // future objectives stay hidden
			String mark = done ? "[x] " : "> ";
			int col = done ? Font.CR_DARKGRAY : (flash ? Font.CR_WHITE : Font.CR_GOLD);
			DrawString(fSmall, mark .. ev.objText[i], (-8, y), R | DI_TEXT_ALIGN_RIGHT, col, done ? 0.7 : 1.0, -1, 4, (0.7, 0.7));
			if (done)
			{
				double w = fSmall.mFont.StringWidth(mark .. ev.objText[i]) * 0.7;
				Fill(0xb0a0a0a0, -8 - w, y + 5, w, 1, R);
			}
			y += 10;
		}
	}

	// ---------------------------------------------------------------- vitals (bottom left)
	void DrawVitals(CCAPlayer pmo)
	{
		int L = DI_SCREEN_LEFT_BOTTOM;
		int hp = CPlayer.health;
		let armor = BasicArmor(CPlayer.mo.FindInventory("BasicArmor"));
		int ap = armor ? armor.Amount : 0;
		Fill(0x90081012, 6, -52, 164, 46, L);
		DrawString(fBig, String.Format("%d", hp), (14, -48), L | DI_TEXT_ALIGN_LEFT, hp <= 25 ? Font.CR_RED : Font.CR_WHITE, 1, -1, 4, (2, 2));
		DrawString(fSmall, "HEALTH", (14, -18), L | DI_TEXT_ALIGN_LEFT, Font.CR_GREEN, 1, -1, 4, (0.6, 0.6));
		DrawString(fBig, String.Format("%d", ap), (76, -48), L | DI_TEXT_ALIGN_LEFT, Font.CR_LIGHTBLUE, 1, -1, 4, (2, 2));
		DrawString(fSmall, "ARMOR", (76, -18), L | DI_TEXT_ALIGN_LEFT, Font.CR_GREEN, 1, -1, 4, (0.6, 0.6));
		if (pmo)
		{
			// flashlight battery
			Fill(0xff202020, 14, -9, 60, 3, L);
			Fill(pmo.flashOn ? 0xfff0e0a0 : 0xff807050, 14, -9, 60 * pmo.battery / 100, 3, L);
			// grenades
			String gi = pmo.grenType == 0 ? "GFRGA0" : "GDETA0";
			int gc = pmo.CountInv(pmo.grenType == 0 ? "FragGrenades" : "AlienDetonators");
			DrawImage(gi, (140, -30), L | DI_ITEM_CENTER, gc > 0 ? 1.0 : 0.35, (18, 18));
			DrawString(fSmall, String.Format("x%d", gc), (150, -34), L | DI_TEXT_ALIGN_LEFT, Font.CR_WHITE, 1, -1, 4, (0.7, 0.7));
		}
	}

	// ---------------------------------------------------------------- ammo (bottom right)
	void DrawAmmo(CCAPlayer pmo)
	{
		int B = DI_SCREEN_RIGHT_BOTTOM;
		let w = CCAWeapon(CPlayer.ReadyWeapon);
		Fill(0x90081012, -176, -52, 170, 46, B);
		if (w)
		{
			DrawString(fSmall, w.GetTag(), (-10, -50), B | DI_TEXT_ALIGN_RIGHT, Font.CR_GOLD, 1, -1, 4, (0.7, 0.7));
			if (w.magSize > 0)
			{
				String m = w.dual ? String.Format("%d|%d", w.magL, w.mag) : String.Format("%d", w.mag);
				DrawString(fBig, m, (-60, -40), B | DI_TEXT_ALIGN_RIGHT, w.mag == 0 ? Font.CR_RED : Font.CR_WHITE, 1, -1, 4, (2, 2));
				DrawString(fSmall, String.Format("/ %d", w.Reserve()), (-10, -26), B | DI_TEXT_ALIGN_RIGHT, Font.CR_GRAY, 1, -1, 4, (0.8, 0.8));
			}
			else if (w.Ammo1)
				DrawString(fBig, String.Format("%d", w.Reserve()), (-10, -40), B | DI_TEXT_ALIGN_RIGHT, Font.CR_CYAN, 1, -1, 4, (2, 2));
			if (w.heatPerShot > 0)
			{
				Fill(0xff202020, -166, -11, 100, 4, B);
				Fill(w.venting ? 0xffff4030 : 0xff60ffd0, -166, -11, w.heat, 4, B);
			}
			if (w.hasPair) DrawString(fSmall, w.dual ? "DUAL" : "x2", (-170, -50), B | DI_TEXT_ALIGN_LEFT, Font.CR_LIGHTBLUE, 1, -1, 4, (0.6, 0.6));
		}
		static const String KEYS[] = { "CCABlueCard", "CCARedCard", "CCAYellowCard" };
		static const String KEYIMG[] = { "KBLUA0", "KREDA0", "KYELA0" };
		for (int i = 0; i < 3; i++)
			if (CPlayer.mo.FindInventory(KEYS[i])) DrawImage(KEYIMG[i], (-186 - i * 14, -30), B | DI_ITEM_CENTER, 1, (12, 12));
	}

	// ---------------------------------------------------------------- gauges
	void DrawGauges(CCAEvents ev)
	{
		if (!ev) return;
		let term = HackTerminal(ev.hackTerminal);
		if (term && term.active)
		{
			double f = term.Fraction();
			int secs = (term.total - term.progress) / 35;
			int T = DI_SCREEN_CENTER_TOP;
			double gy = 70;
			Fill(0xb0081012, -114, gy - 16, 228, 30, T);
			DrawString(fSmall, String.Format("%s  %d%%  %d:%02d", term.InRange() ? "UPLOADING" : "PAUSED - GET BACK TO THE TERMINAL", int(f * 100), secs / 60, secs % 60),
				(0, gy - 14), T | DI_TEXT_ALIGN_CENTER, term.InRange() ? Font.CR_GREEN : Font.CR_RED, 1, -1, 4, (0.7, 0.7));
			Fill(0xff1c2a22, -110, gy, 220, 8, T);
			Fill(term.InRange() ? 0xff50ff90 : 0xffb04030, -110, gy, 220 * f, 8, T);
		}
		if (ev.reviveTarget)
		{
			int C = DI_SCREEN_CENTER;
			DrawString(fSmall, "REVIVING", (0, 28), C | DI_TEXT_ALIGN_CENTER, Font.CR_WHITE, 1, -1, 4, (0.7, 0.7));
			Fill(0xff202020, -60, 40, 120, 5, C);
			Fill(0xffffcf6e, -60, 40, 120 * clamp(ev.reviveFrac, 0, 1), 5, C);
		}
		let pmo = CCAPlayer(CPlayer.mo);
		if (pmo && pmo.cooking && pmo.grenType == 0)
		{
			double f = 1.0 - double(pmo.cookTics) / CCAPlayer.FRAG_FUSE;
			Fill(0xff202020, -30, 24, 60, 3, DI_SCREEN_CENTER);
			Fill(f < 0.3 ? 0xffff3020 : 0xffffd040, -30, 24, 60 * f, 3, DI_SCREEN_CENTER);
		}
	}

	// ---------------------------------------------------------------- battle-rifle scope
	void DrawScope()
	{
		let w = CCAWeapon(CPlayer.ReadyWeapon);
		if (!w || !w.ads || !(w is "CCA_BattleRifle")) return;
		// a translucent blue-grey surround with a lens edge (not solid black)
		DrawImage("SCOPEMSK", (0, 0), DI_SCREEN_CENTER | DI_ITEM_CENTER, 0.85, (HH * 1.05, HH * 1.05));
		Fill(0x9018222a, -HW, -HH, HW - HH * 0.52, HH * 2, DI_SCREEN_CENTER);
		Fill(0x9018222a, HH * 0.52, -HH, HW, HH * 2, DI_SCREEN_CENTER);
	}
}

// ---------------------------------------------------------------- overlay: waypoint + reticle
class CCAOverlay : EventHandler
{
	ui double lastGap;

	// World → screen with GZDoom's projection (Hor+; 1.2 vertical pixel stretch).
	ui Vector3 Project(RenderEvent e, Vector3 world)
	{
		double fov = e.Camera && e.Camera.player ? e.Camera.player.fov : 90;
		double SW = Screen.GetWidth(), SH = Screen.GetHeight();
		double half43 = SH * 4.0 / 3.0 / 2.0;
		if (SW / SH < 4.0 / 3.0) half43 = SW / 2;
		double focal = half43 / tan(fov / 2);
		Vector3 d = world - e.ViewPos;
		double cy = cos(e.ViewAngle), sy = sin(e.ViewAngle);
		double fwd = d.x * cy + d.y * sy;
		double side = d.x * sy - d.y * cy;
		double cp = cos(e.ViewPitch), sp = sin(e.ViewPitch);
		double f2 = fwd * cp - d.z * sp;
		double u2 = d.z * cp + fwd * sp;
		if (f2 < 1) return (0, 0, 0);
		double stretch = Level.info ? Level.info.pixelstretch : 1.2;
		return (SW / 2 + side / f2 * focal, SH / 2 - u2 * stretch / f2 * focal, 1);
	}

	override void RenderOverlay(RenderEvent e)
	{
		let p = players[consoleplayer];
		if (!p.mo || p.health <= 0 || automapactive) return;
		DrawWaypoint(e);
		DrawReticle(e, p);
	}

	ui void DrawWaypoint(RenderEvent e)
	{
		let ev = CCAEvents.Get();
		if (!ev || !ev.wpValid) return;
		Vector3 tp = ev.wpPos;
		double dist = (tp - e.ViewPos).Length() / 32.0;     // metres
		double SW = Screen.GetWidth(), SH = Screen.GetHeight();
		Vector3 pr = Project(e, tp);
		Vector2 s = pr.xy;
		bool onScreen = pr.z > 0 && s.x > 20 && s.x < SW - 20 && s.y > 20 && s.y < SH - 20;
		if (!onScreen)
		{
			// clamp to the edge in the target's direction
			Vector2 rel = (tp.xy - e.ViewPos.xy);
			double a = atan2(rel.y, rel.x) - e.ViewAngle;
			double sx = -sin(a), sy2 = -cos(a);
			double k = min((SW / 2 - 30) / max(abs(sx), 0.001), (SH / 2 - 30) / max(abs(sy2), 0.001));
			s = (SW / 2 + sx * k, SH / 2 + sy2 * k);
		}
		double pulse = ev.waypointPulse > 0 ? 1.0 + 0.4 * sin(Level.maptime * 20.0) : 1.0;
		double r = 9 * pulse * CleanXfac_1;
		Color c = 0xffffbe5a;
		Screen.DrawThickLine(s.x, s.y - r, s.x + r, s.y, 2, c, 230);
		Screen.DrawThickLine(s.x + r, s.y, s.x, s.y + r, 2, c, 230);
		Screen.DrawThickLine(s.x, s.y + r, s.x - r, s.y, 2, c, 230);
		Screen.DrawThickLine(s.x - r, s.y, s.x, s.y - r, 2, c, 230);
		String t = String.Format("%dm", int(dist));
		Screen.DrawText(NewSmallFont, Font.CR_GOLD, s.x - NewSmallFont.StringWidth(t) * CleanXfac_1 / 2, s.y + r + 2, t, DTA_CleanNoMove_1, true);
	}

	ui void DrawReticle(RenderEvent e, PlayerInfo p)
	{
		let w = CCAWeapon(p.ReadyWeapon);
		if (!w) return;
		double SW = Screen.GetWidth(), SH = Screen.GetHeight();
		double cx = SW / 2, cy = SH / 2;
		double fov = p.fov;
		double half43 = min(SW / 2, SH * 4.0 / 3.0 / 2.0);
		double spread = w.SpreadNow(p.mo);
		double gap = max(4, tan(spread) / tan(fov / 2) * half43);
		lastGap = lastGap > 0 ? lastGap + (gap - lastGap) * 0.35 : gap;
		gap = lastGap;
		Color c = 0xffe8f0ff;
		// red over a hostile in range
		let ev = CCAEvents.Get();
		if (ev && ev.aimHostile) c = 0xffff463c;
		double s = CleanXfac_1;
		if (ev && Level.maptime - ev.hitMarkerTic < 6)
		{
			Screen.DrawThickLine(cx - 9 * s, cy - 9 * s, cx - 4 * s, cy - 4 * s, 2, 0xffffffff, 255);
			Screen.DrawThickLine(cx + 9 * s, cy - 9 * s, cx + 4 * s, cy - 4 * s, 2, 0xffffffff, 255);
			Screen.DrawThickLine(cx - 9 * s, cy + 9 * s, cx - 4 * s, cy + 4 * s, 2, 0xffffffff, 255);
			Screen.DrawThickLine(cx + 9 * s, cy + 9 * s, cx + 4 * s, cy + 4 * s, 2, 0xffffffff, 255);
		}
		if (w.ads && w.reticle != 7) { Screen.DrawThickLine(cx - 1, cy, cx + 1, cy, 2, c, 200); return; }   // the sights do the work
		double L = 7 * s;
		switch (w.reticle)
		{
		case 0:   // melee: a small dot
			Screen.DrawThickLine(cx - 1.5 * s, cy, cx + 1.5 * s, cy, 3 * s, c, 200);
			break;
		case 2:   // shotgun: a circle of four arcs
			for (int i = 0; i < 4; i++)
			{
				double a0 = i * 90 + 20, a1 = i * 90 + 70;
				for (double a = a0; a < a1; a += 10)
					Screen.DrawThickLine(cx + cos(a) * gap, cy + sin(a) * gap, cx + cos(a + 10) * gap, cy + sin(a + 10) * gap, 1.5 * s, c, 220);
			}
			break;
		case 5: case 6: // alien: a triangle of chevrons
			for (int i = 0; i < 3; i++)
			{
				double a = 90 + i * 120;
				double x0 = cx + cos(a) * gap, y0 = cy + sin(a) * gap;
				Screen.DrawThickLine(x0, y0, x0 + cos(a + 30) * L, y0 + sin(a + 30) * L, 1.5 * s, 0xffb18cff, 230);
				Screen.DrawThickLine(x0, y0, x0 + cos(a - 30) * L, y0 + sin(a - 30) * L, 1.5 * s, 0xffb18cff, 230);
			}
			break;
		default:  // pistols / rifles: four ticks that open with spread
			Screen.DrawThickLine(cx - gap - L, cy, cx - gap, cy, 1.5 * s, c, 230);
			Screen.DrawThickLine(cx + gap, cy, cx + gap + L, cy, 1.5 * s, c, 230);
			Screen.DrawThickLine(cx, cy - gap - L, cx, cy - gap, 1.5 * s, c, 230);
			Screen.DrawThickLine(cx, cy + gap, cx, cy + gap + L, 1.5 * s, c, 230);
			break;
		}
		if (w.dual)   // two carets for akimbo
		{
			Screen.DrawThickLine(cx - gap - L * 2, cy + L, cx - gap - L, cy, 1.5 * s, c, 180);
			Screen.DrawThickLine(cx + gap + L * 2, cy + L, cx + gap + L, cy, 1.5 * s, c, 180);
		}
	}
}
