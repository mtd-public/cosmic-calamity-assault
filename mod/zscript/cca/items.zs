// Ammo, health, armour, keys and objective items. Human guns use real
// calibres; every alien weapon shares one universal ammo, AlienEnergy.

// ---------------------------------------------------------------- ammo
class Ammo9mm : Ammo
{
	Default { Inventory.Amount 15; Inventory.MaxAmount 200; Ammo.BackpackAmount 30; Ammo.BackpackMaxAmount 400; Inventory.Icon "A9MMA0"; Tag "$C51_AMMO_9MM"; Inventory.PickupMessage "$C51_GOT_9MM"; Inventory.PickupSound "items/ammo"; Scale 0.5; }
	States { Spawn: A9MM A -1; Stop; }
}
class Ammo9mmMag : Ammo9mm { States { Spawn: A9MM A -1; Stop; } }
class Ammo9mmBox : Ammo9mm { Default { Inventory.Amount 60; Inventory.PickupMessage "$C51_GOT_9MMBOX"; } States { Spawn: A9BX A -1; Stop; } }

class Ammo12g : Ammo
{
	Default { Inventory.Amount 4; Inventory.MaxAmount 50; Ammo.BackpackAmount 8; Ammo.BackpackMaxAmount 100; Inventory.Icon "ASHLA0"; Tag "$C51_AMMO_12G"; Inventory.PickupMessage "$C51_GOT_SHELLS"; Inventory.PickupSound "items/ammo"; Scale 0.5; }
	States { Spawn: ASHL A -1; Stop; }
}
class AmmoShells : Ammo12g { States { Spawn: ASHL A -1; Stop; } }
class AmmoShellBox : Ammo12g { Default { Inventory.Amount 20; Inventory.PickupMessage "$C51_GOT_SHELLBOX"; } States { Spawn: ASHB A -1; Stop; } }

class Ammo556 : Ammo
{
	Default { Inventory.Amount 30; Inventory.MaxAmount 240; Ammo.BackpackAmount 30; Ammo.BackpackMaxAmount 480; Inventory.Icon "A556A0"; Tag "$C51_AMMO_556"; Inventory.PickupMessage "$C51_GOT_556"; Inventory.PickupSound "items/ammo"; Scale 0.5; }
	States { Spawn: A556 A -1; Stop; }
}
class Ammo556Mag : Ammo556 { States { Spawn: A556 A -1; Stop; } }
class Ammo556Box : Ammo556 { Default { Inventory.Amount 90; Inventory.PickupMessage "$C51_GOT_556BOX"; } States { Spawn: A55B A -1; Stop; } }

class Ammo762 : Ammo
{
	Default { Inventory.Amount 20; Inventory.MaxAmount 120; Ammo.BackpackAmount 20; Ammo.BackpackMaxAmount 240; Inventory.Icon "A762A0"; Tag "$C51_AMMO_762"; Inventory.PickupMessage "$C51_GOT_762"; Inventory.PickupSound "items/ammo"; Scale 0.5; }
	States { Spawn: A762 A -1; Stop; }
}
class Ammo762Mag : Ammo762 { States { Spawn: A762 A -1; Stop; } }

class AlienEnergy : Ammo
{
	Default { Inventory.Amount 20; Inventory.MaxAmount 300; Ammo.BackpackAmount 40; Ammo.BackpackMaxAmount 600; Inventory.Icon "AENCA0"; Tag "$C51_AMMO_ENERGY"; Inventory.PickupMessage "$C51_GOT_CELL"; Inventory.PickupSound "items/energy"; Scale 0.5; }
	States { Spawn: AENC AB 8 Bright; Loop; }
}
class AlienEnergyCell : AlienEnergy { States { Spawn: AENC AB 8 Bright; Loop; } }
class AlienEnergyPod : AlienEnergy { Default { Inventory.Amount 80; Inventory.PickupMessage "$C51_GOT_POD"; } States { Spawn: AENP AB 8 Bright; Loop; } }

// grenades are Ammo so the backpack / max logic is free
class FragGrenades : Ammo
{
	Default { Inventory.Amount 1; Inventory.MaxAmount 4; Ammo.BackpackAmount 1; Ammo.BackpackMaxAmount 6; Inventory.Icon "GFRGA0"; Tag "$C51_AMMO_FRAG"; Inventory.PickupMessage "$C51_GOT_FRAG"; Inventory.PickupSound "items/ammo"; Scale 0.5; }
	States { Spawn: GFRG A -1; Stop; }
}
class FragPickup : FragGrenades { States { Spawn: GFRG A -1; Stop; } }
class AlienDetonators : Ammo
{
	Default { Inventory.Amount 1; Inventory.MaxAmount 3; Ammo.BackpackAmount 1; Ammo.BackpackMaxAmount 5; Inventory.Icon "GDETA0"; Tag "$C51_AMMO_DET"; Inventory.PickupMessage "$C51_GOT_DET"; Inventory.PickupSound "items/energy"; Scale 0.5; }
	States { Spawn: GDET A -1 Bright; Stop; }
}
class DetonatorPickup : AlienDetonators { States { Spawn: GDET A -1 Bright; Stop; } }

// ---------------------------------------------------------------- health / armour
class Stim : Health
{
	Default { Inventory.Amount 10; Inventory.PickupMessage "$C51_GOT_STIM"; Inventory.PickupSound "items/health"; Scale 0.5; }
	States { Spawn: HSTM A -1; Stop; }
}
class Medkit : Health
{
	Default { Inventory.Amount 25; Inventory.PickupMessage "$C51_GOT_MEDKIT"; Inventory.PickupSound "items/health"; Scale 0.5; }
	States { Spawn: HMED A -1; Stop; }
}
class AlienImplant : Health
{
	Default { Inventory.Amount 100; Inventory.MaxAmount 200; +COUNTITEM; +INVENTORY.ALWAYSPICKUP; Inventory.PickupMessage "$C51_GOT_IMPLANT"; Inventory.PickupSound "items/implant"; Scale 0.5; }
	States { Spawn: HIMP ABCDCB 5 Bright; Loop; }
}
class KevlarVest : BasicArmorPickup
{
	Default { Armor.SavePercent 33.335; Armor.SaveAmount 100; Inventory.Icon "AKEVA0"; Inventory.PickupMessage "$C51_GOT_KEVLAR"; Inventory.PickupSound "items/armor"; Scale 0.5; }
	States { Spawn: AKEV A -1; Stop; }
}
class TacticalArmor : BasicArmorPickup
{
	Default { Armor.SavePercent 50; Armor.SaveAmount 200; Inventory.Icon "ATACA0"; Inventory.PickupMessage "$C51_GOT_TACTICAL"; Inventory.PickupSound "items/armor"; Scale 0.5; }
	States { Spawn: ATAC A -1; Stop; }
}
class FlashlightBattery : CustomInventory
{
	Default { Inventory.PickupMessage "$C51_GOT_BATTERY"; Inventory.PickupSound "items/ammo"; Scale 0.5; }
	States
	{
	Spawn:
		BATT A -1;
		Stop;
	Pickup:
		TNT1 A 0
		{
			let p = CCAPlayer(self);
			if (!p || p.battery >= 100) return false;
			p.battery = min(100, p.battery + 60);
			return true;
		}
		Stop;
	}
}

// ---------------------------------------------------------------- keys (LOCKDEFS maps locks 1/2/3 to these)
class CCABlueCard : Key
{
	Default { Inventory.Icon "KBLUA0"; Inventory.PickupMessage "$C51_GOT_BLUECARD"; Inventory.PickupSound "items/key"; Scale 0.5; Species "BlueCard"; }
	States { Spawn: KBLU A 10; KBLU B 10 Bright; Loop; }
}
class CCARedCard : Key
{
	Default { Inventory.Icon "KREDA0"; Inventory.PickupMessage "$C51_GOT_REDCARD"; Inventory.PickupSound "items/key"; Scale 0.5; Species "RedCard"; }
	States { Spawn: KRED A 10; KRED B 10 Bright; Loop; }
}
class CCAYellowCard : Key
{
	Default { Inventory.Icon "KYELA0"; Inventory.PickupMessage "$C51_GOT_YELLOWCARD"; Inventory.PickupSound "items/key"; Scale 0.5; Species "YellowCard"; }
	States { Spawn: KYEL A 10; KYEL B 10 Bright; Loop; }
}

// ---------------------------------------------------------------- objective items
// args[0] overrides the objective id they complete.
class CCAObjectiveItem : CustomInventory abstract
{
	int objId;
	property ObjectiveId: objId;
	Default { +INVENTORY.ALWAYSPICKUP; +COUNTITEM; +FLOATBOB; Inventory.PickupSound "items/objective"; Scale 0.5; }
	override bool TryPickup(in out Actor toucher)
	{
		if (!toucher || !toucher.player) return false;
		let ev = CCAEvents.Get();
		if (ev) ev.Complete(args[0] > 0 ? args[0] : objId);
		GoAwayAndDie();
		return true;
	}
}
class Dossier : CCAObjectiveItem
{
	Default { CCAObjectiveItem.ObjectiveId 1; Inventory.PickupMessage "$C51_GOT_DOSSIER"; }
	States { Spawn: ODOS A -1; Stop; }
}
class HDDCache : CCAObjectiveItem
{
	Default { CCAObjectiveItem.ObjectiveId 2; Inventory.PickupMessage "$C51_GOT_HDD"; }
	States { Spawn: OHDD A -1 Bright; Stop; }
}
class CaseFile : CCAObjectiveItem
{
	Default { CCAObjectiveItem.ObjectiveId 1; Inventory.PickupMessage "$C51_GOT_CASEFILE"; }
	States { Spawn: OCSF A -1; Stop; }
}
class NavShard : CCAObjectiveItem
{
	Default { CCAObjectiveItem.ObjectiveId 1; Inventory.PickupMessage "$C51_GOT_SHARD"; }
	States { Spawn: OSHD AB 8 Bright; Loop; }
}
