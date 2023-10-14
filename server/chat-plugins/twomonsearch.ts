import {FS, ProcessManager, Utils, Net} from '../../lib';
import {TeamValidator} from '../../sim/team-validator';
import {Chat} from '../chat';
import { commands as dscommands } from './datasearch';
import { commands as dtcommands } from '../chat-commands/info';

function getMod(target: string) {
	const arr = target.split(',').map(x => x.trim());
	const modTerm = arr.find(x => {
		const sanitizedStr = x.toLowerCase().replace(/[^a-z0-9=]+/g, '');
		return sanitizedStr.startsWith('mod=') && Dex.dexes[toID(sanitizedStr.split('=')[1])];
	});
	const count = arr.filter(x => {
		const sanitizedStr = x.toLowerCase().replace(/[^a-z0-9=]+/g, '');
		return sanitizedStr.startsWith('mod=');
	}).length;
	if (modTerm) arr.splice(arr.indexOf(modTerm), 1);
	return {splitTarget: arr, usedMod: modTerm ? toID(modTerm.split(/ ?= ?/)[1]) : undefined, count};
}

export const commands: Chat.ChatCommands = {
    wtf(target, room, user, connection, cmd, message) {
		if (!this.runBroadcast()) return;
		this.sendReplyBox(
			'You can <button name="avatars">change ' +
			'your avatar</button> by clicking on it in the <button ' +
			'name="openOptions"><i class="icon-cog"></i> Options' +
			'</button> menu in the upper right. Custom avatars are ' +
			'only obtainable by staff.'+
            'also help me please lmfao idk how to do this'
		);
	},
	tms: 'twomonsearch',
    twomonsearch(target, room, user, connection, cmd, message) {
        this.checkBroadcast();

		if(!target) return this.parse('/help twomonsearch');

		target = target.slice(0,300);

		//splits the two pokemon into array
		const split = target.split(',').map(term => term.trim());
		console.log(split);

		//checks if the two pokemon are valid
		if(split.length !== 2) return this.sendReplyBox('Requires two Pokemon');
		const newTargets = split.map(term => Dex.dataSearch(term));
		console.log(newTargets);
		if(!newTargets || !newTargets[0] || !newTargets[0].length || !newTargets[1] || !newTargets[1].length) return this.sendReplyBox('Requires two valid Pokemon');
		if(newTargets[0][0].searchType !== 'pokemon' || newTargets[1][0].searchType !== 'pokemon') return this.sendReplyBox('Requires two valid Pokemon');

		const {splitTarget, usedMod, count} = getMod(target);
		if (count > 1) {
			return {error: `You can't run searches for multiple mods.`};
		}

		const mod = Dex.mod(usedMod || 'base');

		//get common moves of the two pokemon, stolen from bumba


		const getFullLearnsetOfPokemon = (species: Species, natDex: boolean) => {
			let usedSpecies: Species = Utils.deepClone(species);
			let usedSpeciesLearnset: LearnsetData = Utils.deepClone(mod.species.getLearnset(usedSpecies.id));
			if (!usedSpeciesLearnset) {
				usedSpecies = Utils.deepClone(mod.species.get(usedSpecies.baseSpecies));
				usedSpeciesLearnset = Utils.deepClone(mod.species.getLearnset(usedSpecies.id) || {});
			}
			const lsetData = new Set<string>();
			for (const move in usedSpeciesLearnset) {
				const learnset = mod.species.getLearnset(usedSpecies.id);
				if (!learnset) break;
				const sources = learnset[move];
				for (const learned of sources) {
					const sourceGen = parseInt(learned.charAt(0));
					if (sourceGen <= mod.gen && (mod.gen < 9 || sourceGen >= 9 || natDex)) lsetData.add(move);
				}
			}
	
			while (usedSpecies.prevo) {
				usedSpecies = Utils.deepClone(mod.species.get(usedSpecies.prevo));
				usedSpeciesLearnset = Utils.deepClone(mod.species.getLearnset(usedSpecies.id));
				for (const move in usedSpeciesLearnset) {
					const learnset = mod.species.getLearnset(usedSpecies.id);
					if (!learnset) break;
					const sources = learnset[move];
					for (const learned of sources) {
						const sourceGen = parseInt(learned.charAt(0));
						if (sourceGen <= mod.gen && (mod.gen < 9 || sourceGen === 9 || natDex)) lsetData.add(move);
					}
				}
			}
	
			return lsetData;
		};

		const targetMons: {name: string, shouldBeExcluded: boolean}[] = [];
		//fill targetMons with the two Pokemon we got from newTargets
		for(const mon of newTargets) {
			if(mon){
				targetMons.push({name: mon[0].name, shouldBeExcluded: false});
			}
		}
		const validMoves = new Set(Object.keys(mod.data.Moves));
		for (const mon of targetMons) {
			const species = mod.species.get(mon.name);
			const lsetData = getFullLearnsetOfPokemon(species, false);
			// This pokemon's learnset needs to be excluded, so we perform a difference operation
			// on the valid moveset and this pokemon's moveset.
			if (mon.shouldBeExcluded) {
				for (const move of lsetData) {
					validMoves.delete(move);
				}
			} else {
				// This pokemon's learnset needs to be included, so we perform an intersection operation
				// on the valid moveset and this pokemon's moveset.
				for (const move of validMoves) {
					if (!lsetData.has(move)) {
						validMoves.delete(move);
					}
				}
			}
		}
		console.log(validMoves);
		
		let species1: {types: string[], [k: string]: any} = Dex.species.get(targetMons[0].name);
		let species2: {types: string[], [k: string]: any} = Dex.species.get(targetMons[1].name);

		//gets similar weaknesses and resistances, stolen from zarel
		const weaknesses1 = [];
		const resistances1 = [];
		const isInverse = false;
		for (const type of Dex.types.names()) {
			const notImmune = Dex.getImmunity(type, species1);
			if (notImmune || isInverse) {
				let typeMod = !notImmune && isInverse ? 1 : 0;
				typeMod += (isInverse ? -1 : 1) * Dex.getEffectiveness(type, species1);
				switch (typeMod) {
				case 1:
					weaknesses1.push(type);
					break;
				case 2:
					weaknesses1.push(type);
					break;
				case 3:
					weaknesses1.push(type);
					break;
				case -1:
					resistances1.push(type);
					break;
				case -2:
					resistances1.push(type);
					break;
				case -3:
					resistances1.push(type);
					break;
				}
			} else {
				resistances1.push(type);
			}
		}


		const weaknesses2: string[] = [];
		const resistances2: string[] = [];
		for (const type of Dex.types.names()) {
			const notImmune = Dex.getImmunity(type, species2);
			if (notImmune || isInverse) {
				let typeMod = !notImmune && isInverse ? 1 : 0;
				typeMod += (isInverse ? -1 : 1) * Dex.getEffectiveness(type, species2);
				switch (typeMod) {
				case 1:
					weaknesses2.push(type);
					break;
				case 2:
					weaknesses2.push(type);
					break;
				case 3:
					weaknesses2.push(type);
					break;
				case -1:
					resistances2.push(type);
					break;
				case -2:
					resistances2.push(type);
					break;
				case -3:
					resistances2.push(type);
					break;
				}
			} else {
				resistances2.push(type);
			}
		}

		//join the two lists, find commonalities
		const weaknesses = weaknesses1.filter(type => weaknesses2.includes(type));
		const resistances = resistances1.filter(type => resistances2.includes(type));
		console.log(weaknesses);
		console.log(resistances);

		const miscompare: string[] = [];
		//get common misc. from two mons' Species objects
		if(species1.color === species2.color) {
			miscompare.push(species1.color);
		}
		//some egg groups come in arrays, we need to filter out the ones that are not in both
		const eggGroups = species1.eggGroups.filter((group: string) => species2.eggGroups.includes(group));
		//append 'group' to each egg group
		eggGroups.forEach((group: string, index: number) => eggGroups[index] = group + 'group');
		//append eggGroups to miscompare
		miscompare.push(...eggGroups);

		if(species1.heightm === species2.heightm) {
			miscompare.push('ht='+species1.heightm);
		}

		if(species1.weightkg === species2.weightkg) {
			miscompare.push('wt='+species1.weightkg);
		}

		if(species1.baseStats.hp === species2.baseStats.hp) {
			miscompare.push('hp='+species1.baseStats.hp);
		}

		if(species1.baseStats.atk === species2.baseStats.atk) {
			miscompare.push('atk='+species1.baseStats.atk);
		}

		if(species1.baseStats.def === species2.baseStats.def) {
			miscompare.push('def='+species1.baseStats.def);
		}

		if(species1.baseStats.spa === species2.baseStats.spa) {
			miscompare.push('spa='+species1.baseStats.spa);
		}

		if(species1.baseStats.spd === species2.baseStats.spd) {
			miscompare.push('spd='+species1.baseStats.spd);
		}

		if(species1.baseStats.spe === species2.baseStats.spe) {
			miscompare.push('spe='+species1.baseStats.spe);
		}

		//abilities is of the form: { '0': 'Swarm', '1': 'Technician', H: 'Light Metal' }, like a dictionary. I want to get the values of the dictionary into a list.
		//do for each mon first
		const abilities1 = Object.values(species1.abilities) as string[];
		const abilities2 = Object.values(species2.abilities) as string[];
		//then filter out the ones that are not in both
		const abilities = abilities1.filter((ability: string) => abilities2.includes(ability));
		//append abilities to miscompare
		miscompare.push(...abilities);

		//get common tier
		if(species1.tier === species2.tier) {
			miscompare.push(species1.tier);
		}

		//get common doubles tier
		if(species1.doublesTier === species2.doublesTier && species1.doublesTier !='(DUU)') {
			miscompare.push(species1.doublesTier);
		}

		//get common types
		const types = species1.types.filter((type: string) => species2.types.includes(type));
		//append to miscompare
		miscompare.push(...types);

		if(species1.nfe === species2.nfe && !species1.nfe) {
			miscompare.push('fe');
		}

		console.log(miscompare);


		const specialCompares: string[] = [];
		const recoveryMoves = [
			"healorder", "junglehealing", "lifedew", "milkdrink", "moonlight", "morningsun", "recover",
			"roost", "shoreup", "slackoff", "softboiled", "strengthsap", "synthesis", "wish",
		];
		//if commonMoves has any recovery moves, add 'recovery' to specialCompares
		if(recoveryMoves.some(move => validMoves.has(move))) {
			specialCompares.push('recovery');
		}

		const zrecoveryMoves = [
			"aromatherapy", "bellydrum", "conversion2", "haze", "healbell", "mist",
			"psychup", "refresh", "spite", "stockpile", "teleport", "transform",
		];
		//if commonMoves has any zrecovery moves, add 'zrecovery' to specialCompares
		if(zrecoveryMoves.some(move => validMoves.has(move))) {
			specialCompares.push('zrecovery');
		}
		/*
		//loop through the validMoves set
		for(const moveString of validMoves) {
			const move = Dex.moves.get(moveString);
			//if the move is a priority move, add 'priority' to specialCompares and break
			if(move.priority > 0 && move.basePower !== 0) {
				specialCompares.push('priority');
				break;
			}
		}*/

		console.log(specialCompares);


		//create a single string of all the parts we logged before
		let dsTarget = '';


		//add validmoves to dsTarget
		const validMovesArray = Array.from(validMoves);
		const validMovesString = validMovesArray.join(',');
		dsTarget += validMovesString;

		//add weaknesses, first add 'weak' to each object of array
		const weaknessesArray = weaknesses.map(weak => 'weak '+weak);
		//then join the array
		const weaknessesString = weaknessesArray.join(',');
		//then add to dsTarget
		//if empty, don't add the ',' to dsTarget
		if(weaknessesString){
			dsTarget += ',' + weaknessesString;
		}

		//add resistances, first add 'resist' to each object of array
		const resistancesArray = resistances.map(resist => 'resists '+resist);
		//then join the array
		const resistancesString = resistancesArray.join(',');
		//then add to dsTarget
		//if empty, don't add the ',' to dsTarget
		if(resistancesString){
			dsTarget += ',' + resistancesString;
		}
		

		//add miscompare
		const miscompareString = miscompare.join(',');
		//if empty, don't add the ',' to dsTarget
		if(miscompareString){
			dsTarget += ',' + miscompareString;
		}

		//add specialCompares
		const specialComparesString = specialCompares.join(',');
		//if empty, don't add the ',' to dsTarget
		if(specialComparesString){
			dsTarget += ',' + specialComparesString;
		}

		//send replybox of dsTarget
		this.sendReplyBox(dsTarget);
    }, 
	twomonsearchhelp() {
		this.sendReplyBox(
			'Takes in two mons, returns the parameters in /nds or /ds for the two mons to be returned, or false if it cannot.'
		)
	}
}