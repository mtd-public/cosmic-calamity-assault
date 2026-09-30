// Props (docs/ASSETS.md §4). Generated table; lights for the ones that glow.

class CCAProp : Actor abstract
{
	Default { Scale 0.5; +NOGRAVITY; }
}

class PropDesk : CCAProp
{
	Default { Radius 24; Height 30; +SOLID }
	States
	{
	Spawn:
		DDSK A -1 ;
		Stop;
	}
}

class PropChair : CCAProp
{
	Default { Radius 10; Height 24; +SOLID }
	States
	{
	Spawn:
		DCHR A -1 ;
		Stop;
	}
}

class PropMonitor : CCAProp
{
	Default { Radius 10; Height 30; +SOLID }
	override void PostBeginPlay() { Super.PostBeginPlay(); A_AttachLight('glow', DynamicLight.PointLight, Color(120, 200, 255), 64, 42, DynamicLight.LF_ATTENUATE, (0, 0, 21), 0.15); }
	States
	{
	Spawn:
		DMON AB 6 Bright;
		Loop;
	}
}

class PropConsole : CCAProp
{
	Default { Radius 16; Height 48; +SOLID }
	override void PostBeginPlay() { Super.PostBeginPlay(); A_AttachLight('glow', DynamicLight.PointLight, Color(120, 255, 200), 80, 53, DynamicLight.LF_ATTENUATE, (0, 0, 34), 0.15); }
	States
	{
	Spawn:
		DTRM AB 8 Bright;
		Loop;
	}
}

class PropTank : CCAProp
{
	Default { Radius 20; Height 80; +SOLID }
	override void PostBeginPlay() { Super.PostBeginPlay(); A_AttachLight('glow', DynamicLight.PointLight, Color(90, 255, 160), 96, 64, DynamicLight.LF_ATTENUATE, (0, 0, 56), 0.15); }
	States
	{
	Spawn:
		DTNK AB 10 ;
		Loop;
	}
}

class PropTankBroken : CCAProp
{
	Default { Radius 20; Height 40; +SOLID }
	States
	{
	Spawn:
		DTNB A -1 ;
		Stop;
	}
}

class PropAutopsy : CCAProp
{
	Default { Radius 28; Height 32; +SOLID }
	States
	{
	Spawn:
		DAUT A -1 ;
		Stop;
	}
}

class PropCabinet : CCAProp
{
	Default { Radius 12; Height 48; +SOLID }
	States
	{
	Spawn:
		DCAB A -1 ;
		Stop;
	}
}

class PropServer : CCAProp
{
	Default { Radius 16; Height 72; +SOLID }
	override void PostBeginPlay() { Super.PostBeginPlay(); A_AttachLight('glow', DynamicLight.PointLight, Color(80, 255, 120), 64, 42, DynamicLight.LF_ATTENUATE, (0, 0, 50), 0.15); }
	States
	{
	Spawn:
		DSRV AB 12 Bright;
		Loop;
	}
}

class PropLabLamp : CCAProp
{
	Default { Radius 8; Height 64; +SOLID }
	override void PostBeginPlay() { Super.PostBeginPlay(); A_AttachLight('glow', DynamicLight.PointLight, Color(255, 236, 200), 160, 106, DynamicLight.LF_ATTENUATE, (0, 0, 45), 0.15); }
	States
	{
	Spawn:
		DLMP A -1 Bright;
		Stop;
	}
}

class PropCylinders : CCAProp
{
	Default { Radius 12; Height 48; +SOLID }
	States
	{
	Spawn:
		DCYL A -1 ;
		Stop;
	}
}

class PropGenerator : CCAProp
{
	Default { Radius 28; Height 48; +SOLID }
	States
	{
	Spawn:
		DGEN A -1 ;
		Stop;
	}
}

class PropCrate : CCAProp
{
	Default { Radius 20; Height 40; +SOLID }
	States
	{
	Spawn:
		DCRT A -1 ;
		Stop;
	}
}

class PropPapers : CCAProp
{
	Default { Radius 16; Height 2; +NOBLOCKMAP +FLATSPRITE }
	States
	{
	Spawn:
		DPAP A -1 ;
		Stop;
	}
}

class PropBloodPool : CCAProp
{
	Default { Radius 16; Height 2; +NOBLOCKMAP +FLATSPRITE }
	States
	{
	Spawn:
		DBLD A -1 ;
		Stop;
	}
}

class PropGlassFloor : CCAProp
{
	Default { Radius 16; Height 2; +NOBLOCKMAP +FLATSPRITE }
	States
	{
	Spawn:
		DGLS A -1 ;
		Stop;
	}
}

class PropAlienGrowth : CCAProp
{
	Default { Radius 16; Height 56; +SOLID }
	override void PostBeginPlay() { Super.PostBeginPlay(); A_AttachLight('glow', DynamicLight.PointLight, Color(90, 255, 200), 112, 74, DynamicLight.LF_ATTENUATE, (0, 0, 39), 0.15); }
	States
	{
	Spawn:
		DALN AB 12 Bright;
		Loop;
	}
}

class PropCarWreck : CCAProp
{
	Default { Radius 48; Height 48; +SOLID }
	override void PostBeginPlay() { Super.PostBeginPlay(); A_AttachLight('glow', DynamicLight.FlickerLight, Color(255, 140, 50), 192, 128, DynamicLight.LF_ATTENUATE, (0, 0, 34), 0.15); }
	States
	{
	Spawn:
		DCAR ABC 4 Bright;
		Loop;
	}
}

class PropHydrant : CCAProp
{
	Default { Radius 8; Height 24; +SOLID }
	States
	{
	Spawn:
		DHYD A -1 ;
		Stop;
	}
}

class PropStreetLamp : CCAProp
{
	Default { Radius 8; Height 128; +SOLID }
	override void PostBeginPlay() { Super.PostBeginPlay(); A_AttachLight('glow', DynamicLight.PointLight, Color(255, 170, 90), 256, 170, DynamicLight.LF_ATTENUATE, (0, 0, 90), 0.15); }
	States
	{
	Spawn:
		DLPT A -1 ;
		Stop;
	}
}

class PropDumpster : CCAProp
{
	Default { Radius 32; Height 40; +SOLID }
	States
	{
	Spawn:
		DDMP A -1 ;
		Stop;
	}
}

class PropTrash : CCAProp
{
	Default { Radius 16; Height 16; +NOBLOCKMAP }
	States
	{
	Spawn:
		DTRS A -1 ;
		Stop;
	}
}

class PropBench : CCAProp
{
	Default { Radius 24; Height 24; +SOLID }
	States
	{
	Spawn:
		DBNC A -1 ;
		Stop;
	}
}

class PropPhoneBooth : CCAProp
{
	Default { Radius 16; Height 88; +SOLID }
	States
	{
	Spawn:
		DPHN A -1 ;
		Stop;
	}
}

class PropTrafficLight : CCAProp
{
	Default { Radius 8; Height 120; +SOLID }
	States
	{
	Spawn:
		DTRF ABC 70 Bright;
		Loop;
	}
}

class PropNewsBox : CCAProp
{
	Default { Radius 10; Height 32; +SOLID }
	States
	{
	Spawn:
		DNWS A -1 ;
		Stop;
	}
}

class PropBurningBarrel : CCAProp
{
	Default { Radius 12; Height 32; +SOLID }
	override void PostBeginPlay() { Super.PostBeginPlay(); A_AttachLight('glow', DynamicLight.FlickerLight, Color(255, 140, 50), 144, 96, DynamicLight.LF_ATTENUATE, (0, 0, 22), 0.15); }
	States
	{
	Spawn:
		DBRL ABCD 3 Bright;
		Loop;
	}
}

class PropPine : CCAProp
{
	Default { Radius 16; Height 160; +SOLID }
	States
	{
	Spawn:
		DTRE A -1 ;
		Stop;
	}
}

class PropBush : CCAProp
{
	Default { Radius 16; Height 32; +NOBLOCKMAP }
	States
	{
	Spawn:
		DBSH A -1 ;
		Stop;
	}
}

class PropTent : CCAProp
{
	Default { Radius 48; Height 72; +SOLID }
	States
	{
	Spawn:
		DTNT A -1 ;
		Stop;
	}
}

class PropFloodlight : CCAProp
{
	Default { Radius 12; Height 96; +SOLID }
	override void PostBeginPlay() { Super.PostBeginPlay(); A_AttachLight('glow', DynamicLight.PointLight, Color(255, 250, 235), 320, 213, DynamicLight.LF_ATTENUATE, (0, 0, 67), 0.15); }
	States
	{
	Spawn:
		DFLD A -1 Bright;
		Stop;
	}
}

class PropJeep : CCAProp
{
	Default { Radius 40; Height 48; +SOLID }
	States
	{
	Spawn:
		DJEP A -1 ;
		Stop;
	}
}

class PropRocks : CCAProp
{
	Default { Radius 24; Height 24; +SOLID }
	States
	{
	Spawn:
		DRCK A -1 ;
		Stop;
	}
}

class PropSandbags : CCAProp
{
	Default { Radius 24; Height 28; +SOLID }
	States
	{
	Spawn:
		DSBG A -1 ;
		Stop;
	}
}

class PropHullDebris : CCAProp
{
	Default { Radius 24; Height 32; +SOLID }
	override void PostBeginPlay() { Super.PostBeginPlay(); A_AttachLight('glow', DynamicLight.PointLight, Color(170, 110, 255), 96, 64, DynamicLight.LF_ATTENUATE, (0, 0, 22), 0.15); }
	States
	{
	Spawn:
		DDBR AB 10 Bright;
		Loop;
	}
}

class PropAttackCraft : CCAProp
{
	Default { Radius 96; Height 128; +SOLID }
	States
	{
	Spawn:
		DATK A -1 ;
		Stop;
	}
}

class PropPod : CCAProp
{
	Default { Radius 20; Height 96; +SOLID }
	override void PostBeginPlay() { Super.PostBeginPlay(); A_AttachLight('glow', DynamicLight.PointLight, Color(120, 255, 230), 112, 74, DynamicLight.LF_ATTENUATE, (0, 0, 67), 0.15); }
	States
	{
	Spawn:
		DPOD AB 12 Bright;
		Loop;
	}
}

class PropAlienConsole : CCAProp
{
	Default { Radius 16; Height 48; +SOLID }
	override void PostBeginPlay() { Super.PostBeginPlay(); A_AttachLight('glow', DynamicLight.PointLight, Color(80, 230, 255), 96, 64, DynamicLight.LF_ATTENUATE, (0, 0, 34), 0.15); }
	States
	{
	Spawn:
		DCNS AB 8 Bright;
		Loop;
	}
}

class PropAlienPillar : CCAProp
{
	Default { Radius 24; Height 128; +SOLID }
	States
	{
	Spawn:
		DPLR A -1 ;
		Stop;
	}
}


// Explosive fuel drum: shoot it.
class ExplosiveDrum : Actor
{
	Default { Health 20; Radius 12; Height 34; Scale 0.5; +SOLID +SHOOTABLE +NOBLOOD +ACTIVATEMCROSS +DONTGIB +NOICEDEATH +OLDRADIUSDMG; DeathSound "world/drumboom"; Obituary "$C51_OB_DRUM"; }
	States
	{
	Spawn:
		DBAR AB 8;
		Loop;
	Death:
		DBAR C 4 Bright;
		DBAR D 4 Bright A_Scream;
		DBAR E 4 Bright;
		DBAR F 4 Bright { A_Explode(128, 128); A_QuakeEx(2, 2, 2, 10, 0, 384, "", QF_SCALEDOWN); }
		DBAR G 10 Bright;
		TNT1 A 1050 Bright A_BarrelDestroy;
		TNT1 A 5 A_Respawn;
		Wait;
	}
}

// Hive conduit (MAP04). args[0] = 1: shootable; each one destroyed slows
// the Hive Mind's spawning and IRIS counts them down.
class PropHiveConduit : Actor
{
	Default { Health 250; Radius 20; Height 128; Mass 10000; Scale 0.5; +SOLID +NOBLOOD +DONTTHRUST +NOGRAVITY; DeathSound "hive/conduit"; Tag "$C51_TAG_CONDUIT"; }
	override void PostBeginPlay()
	{
		Super.PostBeginPlay();
		if (args[0] == 1) bShootable = true;
		A_AttachLight('glow', DynamicLight.PulseLight, Color(80, 255, 220), 128, 64, DynamicLight.LF_ATTENUATE, (0, 0, 64), 0.8);
	}
	States
	{
	Spawn:
		DHVC ABCB 6 Bright;
		Loop;
	Death:
		DHVC C 6 Bright { A_Explode(48, 96); A_RemoveLight('glow'); let ev = CCAEvents.Get(); if (ev) ev.Say("IRIS_CONDUIT"); }
		DHVC A -1;
		Stop;
	}
}
