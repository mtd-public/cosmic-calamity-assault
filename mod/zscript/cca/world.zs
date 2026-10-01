// Mission logic placed in maps (tools/data/things.json has the arg layouts):
// hack terminals + wave spots, objective markers (HUD waypoint), IRIS
// triggers, the exit gate, curtains, fires, sparks, steam, lights.

// ---------------------------------------------------------------- hack terminal
// args: [0] seconds (60-90), [1] wave group, [2] line special on completion,
// [3] that special's first arg (usually a tag), [4] objective id completed.
// Use it to start; progress pauses while you're > 256 units away; waves come
// from WaveSpots in the same group every 12-15 s, escalating.
class HackTerminal : Actor
{
	int progress, total, waveTimer, wave;
	bool active, done;
	Default
	{
		Radius 16; Height 48; Mass 10000;
		+SOLID +NOGRAVITY +DONTTHRUST +NOTAUTOAIMED
		Scale 0.5;
		Tag "$C51_TAG_TERMINAL";
	}
	clearscope double Fraction() const { return total > 0 ? double(progress) / total : 0; }
	clearscope bool InRange() const
	{
		let p = players[consoleplayer].mo;
		return p && p.health > 0 && Distance2D(p) <= 256;
	}
	override bool Used(Actor user)
	{
		if (done || active || !user.player) return false;
		active = true;
		total = 35 * clamp(args[0] > 0 ? args[0] : 75, 10, 180);
		progress = 0; waveTimer = 70; wave = 0;
		let ev = CCAEvents.Get();
		if (ev) { ev.hackTerminal = self; ev.Say("IRIS_HACK_START"); }
		A_StartSound("world/hackstart", CHAN_BODY);
		A_StartSound("world/hackloop", CHAN_6, CHANF_LOOPING, 0.6);
		SetStateLabel("Active");
		return true;
	}
	override void Tick()
	{
		Super.Tick();
		if (!active || done || isFrozen()) return;
		let ev = CCAEvents.Get();
		if (InRange()) progress++;
		else if ((Level.maptime % 175) == 0 && ev) ev.Say("IRIS_HACK_RANGE");
		if (--waveTimer <= 0)
		{
			wave++;
			waveTimer = random(420, 525);
			SpawnWave();
		}
		if (progress >= total) Finish();
	}
	void SpawnWave()
	{
		let it = ThinkerIterator.Create("WaveSpot");
		WaveSpot s;
		int count = 0;
		while ((s = WaveSpot(it.Next())) != null)
		{
			if (s.args[0] != args[1]) continue;
			int n = 1 + wave / 2;             // escalate: 1, 1, 2, 2, 3 ... per spot
			for (int i = 0; i < n && i < 4; i++) if (s.SpawnOne(wave, i)) count++;
		}
		if (count > 0) A_StartSound("world/wavealarm", CHAN_AUTO, 0, 0.8, ATTN_NONE);
	}
	void Finish()
	{
		done = true; active = false;
		A_StopSound(CHAN_6);
		A_StartSound("world/hackdone", CHAN_BODY);
		let ev = CCAEvents.Get();
		if (ev)
		{
			if (ev.hackTerminal == self) ev.hackTerminal = null;
			if (args[4] > 0) ev.Complete(args[4]);
			ev.Say("IRIS_HACK_DONE");
		}
		if (args[2] > 0) Level.ExecuteSpecial(args[2], players[consoleplayer].mo, null, false, args[3], 16, 0, 0, 0);
		SetStateLabel("Done");
	}
	States
	{
	Spawn:
		DHCK A -1;
		Stop;
	Active:
		DHCK BC 6 Bright;
		Loop;
	Done:
		DHCK D -1 Bright;
		Stop;
	}
}

// args: [0] wave group, [1] mix: 0 greys, 1 thralls, 2 hybrids, 3 mixed, 4 probes, 5 stalkers
class WaveSpot : Actor
{
	Default { +NOBLOCKMAP; +NOGRAVITY; +NOSECTOR; +DONTSPLASH; RenderStyle "None"; }
	bool SpawnOne(int wave, int i)
	{
		class<Actor> t;
		switch (args[1])
		{
		case 0: t = "Grey"; break;
		case 1: t = random(0, 2) ? "Thrall" : "ThrallTrooper"; break;
		case 2: t = "Hybrid"; break;
		case 4: t = "Probe"; break;
		case 5: t = "CCAStalker"; break;
		default:
			switch (min(random(0, 2 + wave), 6))
			{
			case 0: case 1: t = "Grey"; break;
			case 2: t = "Thrall"; break;
			case 3: t = "Hybrid"; break;
			case 4: t = "ThrallTrooper"; break;
			case 5: t = "Probe"; break;
			default: t = "CCAStalker"; break;
			}
			break;
		}
		Vector3 p = pos + (frandom(-40, 40) * i, frandom(-40, 40) * i, 0);
		let m = Spawn(t, p, ALLOW_REPLACE);
		if (!m) return false;
		if (!m.TestMobjLocation()) { m.Destroy(); return false; }
		if (m.bFloat) m.SetZ(m.floorz + 48);
		m.target = players[consoleplayer].mo;
		m.SetStateLabel("See");
		Spawn("CCATeleportFog", m.pos, ALLOW_REPLACE);
		return true;
	}
	States { Spawn: TNT1 A -1; Stop; }
}

// ---------------------------------------------------------------- objective marker (HUD waypoint target)
// args: [0] objective id this waypoint points to
class ObjectiveMarker : Actor
{
	Default { +NOBLOCKMAP; +NOGRAVITY; +NOSECTOR; +DONTSPLASH; RenderStyle "None"; }
	States { Spawn: TNT1 A -1; Stop; }
}

// ---------------------------------------------------------------- IRIS trigger
// args: [0] LANGUAGE id number (IRIS_<n>), [1] radius (default 128), [2] objective to announce (0 none)
class IrisTrigger : Actor
{
	Default { +NOBLOCKMAP; +NOGRAVITY; +NOSECTOR; +DONTSPLASH; RenderStyle "None"; }
	override void Tick()
	{
		if (isFrozen() || (Level.maptime % 5) != 0) return;
		let p = players[consoleplayer].mo;
		double r = args[1] > 0 ? args[1] : 128;
		if (!p || Distance2D(p) > r || abs(p.pos.z - pos.z) > 128) return;
		let ev = CCAEvents.Get();
		if (ev)
		{
			ev.Say(String.Format("IRIS_%d", args[0]));
			if (args[2] > 0) ev.waypointPulse = 105;
		}
		Destroy();
	}
	States { Spawn: TNT1 A -1; Stop; }
}

// ---------------------------------------------------------------- exit gate
// args: [0] required objective bitmask, [1] tag of the exit door to open
// Checks twice a second; opens the door once satisfied, and nags if the
// player reaches it early.
class ExitGate : Actor
{
	bool opened;
	int nagTic;
	Default { +NOBLOCKMAP; +NOGRAVITY; +NOSECTOR; +DONTSPLASH; RenderStyle "None"; }
	override void Tick()
	{
		if (isFrozen() || opened || (Level.maptime % 17) != 0) return;
		let ev = CCAEvents.Get();
		if (!ev) return;
		if (ev.MaskDone(args[0]))
		{
			opened = true;
			Level.ExecuteSpecial(11, players[consoleplayer].mo, null, false, args[1], 16);   // Door_Open(tag, speed)
			A_StartSound("world/exitopen", CHAN_BODY, 0, 1, ATTN_NONE);
			ev.Say("IRIS_EXIT_OPEN");
			return;
		}
		let p = players[consoleplayer].mo;
		if (p && Distance2D(p) < 192 && Level.maptime > nagTic)
		{
			nagTic = Level.maptime + 350;
			ev.Say("IRIS_EXIT_LOCKED");
		}
	}
	States { Spawn: TNT1 A -1; Stop; }
}

// ---------------------------------------------------------------- rescue + helicopter exit
// Where rescued civilians run to (and leave the map out of your sight).
class SafeZone : Actor
{
	Default { +NOBLOCKMAP; +NOGRAVITY; +NOSECTOR; +DONTSPLASH; RenderStyle "None"; }
	States { Spawn: TNT1 A -1; Stop; }
}

// The black helicopter on the roof (MAP02, Dark Forces' Secret Base exit).
// args[0]: objective mask needed before you can board
// args[1]: objective completed on boarding (0 = none); boarding ends the level
// args[2]: 1 = rotors idling slowly until you board
class Helicopter : Actor
{
	bool boarded;
	int boardTic, nagTic;
	Default
	{
		Radius 56; Height 96; Mass 10000; Scale 1.0;
		+SOLID +NOGRAVITY +DONTSPLASH +NOTAUTOAIMED
	}
	override void PostBeginPlay()
	{
		Super.PostBeginPlay();
		A_StartSound("world/helirotor", CHAN_BODY, CHANF_LOOPING, args[2] ? 0.5 : 0.9, ATTN_NORM);
		A_AttachLight('beacon', DynamicLight.PulseLight, Color(255, 40, 30), 24, 72, DynamicLight.LF_ATTENUATE, (0, 0, 92), 0.6);
		A_AttachLight('cabin', DynamicLight.PointLight, Color(120, 160, 255), 96, 0, DynamicLight.LF_ATTENUATE, (0, 0, 48));
		if (args[2]) SetStateLabel("Idle");
	}
	override bool Used(Actor user) { if (user && user.player) TryBoard(user); return true; }
	void TryBoard(Actor p)
	{
		if (boarded) return;
		let ev = CCAEvents.Get();
		if (!ev) return;
		if (!ev.MaskDone(args[0]))
		{
			if (Level.maptime > nagTic) { nagTic = Level.maptime + 350; ev.Say("IRIS_HELI_LOCKED"); }
			return;
		}
		boarded = true;
		boardTic = Level.maptime;
		if (args[1] > 0) ev.Complete(args[1]);
		ev.Say("IRIS_HELI_BOARD");
		A_StartSound("world/heliboard", CHAN_VOICE, 0, 1, ATTN_NONE);
		A_StartSound("world/helirotor", CHAN_BODY, CHANF_LOOPING, 1.0, ATTN_NONE);
		SetStateLabel("Spawn");
		p.bInvulnerable = true;
		if (p.player) p.player.cheats |= CF_TOTALLYFROZEN;
	}
	override void Tick()
	{
		Super.Tick();
		if (isFrozen()) return;
		if (boarded)
		{
			if (Level.maptime - boardTic == 70) Level.ExitLevel(0, false);
			return;
		}
		if ((Level.maptime % 8) != 0) return;
		let p = players[consoleplayer].mo;
		if (p && p.health > 0 && Distance2D(p) < Radius + 72 && abs(p.pos.z - pos.z) < 64) TryBoard(p);
	}
	States
	{
	Spawn:
		DHEL AB 2;
		Loop;
	Idle:
		DHEL CD 5;
		Loop;
	}
}

// The H on the pad: a floor decal.
class HelipadMark : Actor
{
	Default { +NOBLOCKMAP; +NOGRAVITY; +NOINTERACTION; +FLATSPRITE; +DONTSPLASH; Scale 1.0; }
	override void PostBeginPlay() { Super.PostBeginPlay(); SetZ(floorz + 0.5); }
	States { Spawn: DHPD A -1; Stop; }
}

// ---------------------------------------------------------------- curtains, fire, sparks, steam
// A curtain billowing in and out of a broken window: a wall sprite along
// the thing's angle (place it facing into the room).
class Curtain : Actor
{
	Default { +NOBLOCKMAP; +NOGRAVITY; +WALLSPRITE; +DONTSPLASH; Scale 0.5; Radius 8; Height 64; }
	override void PostBeginPlay()
	{
		Super.PostBeginPlay();
		tics = random(1, 8);    // out of phase with its neighbours
	}
	States
	{
	Spawn:
		CURT ABCDEFEDCB 5;
		Loop;
	}
}

// args[0]: size 0 small, 1 medium, 2 large
class RandomFire : Actor
{
	Default { +NOBLOCKMAP; +NOGRAVITY; +DONTSPLASH; RenderStyle "Add"; Alpha 0.95; Radius 16; Height 32; }
	override void PostBeginPlay()
	{
		Super.PostBeginPlay();
		double s = args[0] == 2 ? 1.1 : args[0] == 1 ? 0.8 : 0.5;
		A_SetScale(s * frandom(0.9, 1.1));
		A_AttachLight('fire', DynamicLight.FlickerLight, Color(255, 140, 50), int(64 + 72 * s), int(48 + 60 * s), DynamicLight.LF_ATTENUATE, (0, 0, 20), 0.2);
		A_StartSound("world/fire", CHAN_BODY, CHANF_LOOPING, 0.35 + 0.2 * s, ATTN_STATIC);
		tics = random(1, 4);
	}
	States
	{
	Spawn:
		FIRE ABCDEFGH 3 Bright;
		Loop;
	}
}
class GlassShards : Actor
{
	Default { +NOBLOCKMAP; +NOGRAVITY; +FLATSPRITE; Scale 0.5; }
	States { Spawn: DGLS A -1; Stop; }
}
class SparkSpot : Actor
{
	Default { +NOBLOCKMAP; +NOGRAVITY; +NOSECTOR; }
	override void Tick()
	{
		if (isFrozen() || random(0, 99) > 1) return;
		for (int i = 0; i < 6; i++) A_SpawnItemEx("CCASpark", 0, 0, 0, frandom(-2, 2), frandom(-2, 2), frandom(0, 3), 0, SXF_CLIENTSIDE);
		A_StartSound("world/spark", CHAN_BODY, 0, 0.6);
		A_AttachLight('spark', DynamicLight.PointLight, Color(180, 200, 255), 80, 0, DynamicLight.LF_ATTENUATE);
		A_SetTics(1);
	}
	States { Spawn: TNT1 A 4 A_RemoveLight('spark'); Loop; }
}
class CCASpark : Actor
{
	Default { Radius 1; Height 1; +NOBLOCKMAP; +MISSILE; +DROPOFF; +NOTELEPORT; RenderStyle "Add"; Scale 0.2; Gravity 0.6; }
	States { Spawn: SPRK ABCD 3 Bright; Stop; Death: SPRK D 2 Bright; Stop; }
}
class SteamVent : Actor
{
	Default { +NOBLOCKMAP; +NOGRAVITY; +NOSECTOR; }
	override void Tick()
	{
		if (isFrozen() || (Level.maptime % 3) != 0) return;
		A_SpawnItemEx("CCASteam", 0, 0, 0, frandom(-0.3, 0.3), frandom(-0.3, 0.3), frandom(1.5, 2.5), 0, SXF_CLIENTSIDE);
	}
	States { Spawn: TNT1 A -1; Stop; }
}
class CCASteam : Actor
{
	Default { +NOBLOCKMAP; +NOGRAVITY; +NOINTERACTION; RenderStyle "Translucent"; Alpha 0.35; Scale 0.4; }
	States { Spawn: SMOK ABCDE 6 A_FadeOut(0.06); Stop; }
}

// ---------------------------------------------------------------- lights
// LightLamp: args [0] radius [1..3] r g b [4] 1 = flicker
class LightLamp : Actor
{
	Default { +NOBLOCKMAP; +NOGRAVITY; +NOSECTOR; +DONTSPLASH; }
	override void PostBeginPlay()
	{
		Super.PostBeginPlay();
		int r = args[0] > 0 ? args[0] : 160;
		Color c = (args[1] | args[2] | args[3]) ? Color(args[1], args[2], args[3]) : Color(255, 236, 200);
		A_AttachLight('lamp', args[4] ? DynamicLight.RandomFlickerLight : DynamicLight.PointLight, c, r, args[4] ? r * 2 / 3 : 0, DynamicLight.LF_ATTENUATE, (0, 0, 0), 0.25);
	}
	States { Spawn: TNT1 A -1; Stop; }
}
// Rotating red alarm light. args[0] radius.
class LightAlarm : Actor
{
	Default { +NOBLOCKMAP; +NOGRAVITY; +NOSECTOR; +DONTSPLASH; }
	override void PostBeginPlay()
	{
		Super.PostBeginPlay();
		int r = args[0] > 0 ? args[0] : 192;
		A_AttachLight('alarm', DynamicLight.PulseLight, Color(255, 30, 20), r, r / 5, DynamicLight.LF_ATTENUATE, (0, 0, 0), 1.2);
	}
	States { Spawn: TNT1 A -1; Stop; }
}
// Neon: args [0] radius [1..3] r g b [4] 1 = buzz flicker
class LightNeon : Actor
{
	Default { +NOBLOCKMAP; +NOGRAVITY; +NOSECTOR; +DONTSPLASH; }
	override void PostBeginPlay()
	{
		Super.PostBeginPlay();
		int r = args[0] > 0 ? args[0] : 128;
		Color c = (args[1] | args[2] | args[3]) ? Color(args[1], args[2], args[3]) : Color(255, 60, 200);
		A_AttachLight('neon', args[4] ? DynamicLight.FlickerLight : DynamicLight.PointLight, c, r, args[4] ? r / 3 : 0, 0, (0, 0, 0), 0.05);
		if (args[4]) A_StartSound("world/neonbuzz", CHAN_BODY, CHANF_LOOPING, 0.25, ATTN_STATIC);
	}
	States { Spawn: TNT1 A -1; Stop; }
}
