'use strict';
class GrepoBotConfig
    {
        DoTriumph=false;
        DoGames=false;
        DoTheater=false;
        DoParty=false;
        DoTrade=false;
        DoTasks=false;
        DoSpam=false;
        DoQueue=false;
        Groups = new Array(0);
    }
class GrepoBot {
    Config;
    UseBot = true;
    BotSuccessOnce = false;
    wwMode=true;
    constructor(config) {
        this.Config=config||new GrepoBotConfig();
        //Add World/player combo
        let SpamDestinations={TinyAlpaca:{de155:13722,de157:3428},suchtla95:{}};

        window.GrepoBot = this;
        
        this.SubscribeToGod("ares");
        this.SubscribeToGod("zeus");
        this.SubscribeToGod("hera");
        this.SubscribeToGod("artemis");

    }
    async DoIt()
    {
        setTimeout(()=>this.DoIt(), 602000);
        this.RunBot();
    }
    async DoItQueue()
    {
        setTimeout(()=>this.DoItQueue(), 10000);
        if(!this.Config.DoQueue)
        {
            return;
        }
        this.CheckQueue();
    }
    async Init()
    {
        this.DoIt();
        this.DoItQueue();
    }
    async CheckQueue()
    {
        if (this.UseBot == false || document.getElementById("recaptcha_window") !== null) {
            return;
        }
        let finishBuildOrder=async function(order){

            let data={
                "model_url": "BuildingOrder/"+order.attributes.id,
                "action_name": "buyInstant",
                "arguments":{"order_id":order.attributes.id},
                "town_id": order.attributes.town_id,
                "nl_init": true};
            await window.gpAjax.ajaxPost('frontend_bridge', 'execute',data);
        }
        us.filter(MM.getModels().BuildingOrder,townOrders=>(townOrders.getDuration()<300||townOrders.getTimeLeft()<300)).forEach(finishBuildOrder);
    }
    async RunBot() {
        try {
            console.log("DoBot=" + this.UseBot + " " + Date.now());
            console.log("Hour " + new Date().getHours());
            console.log("Captcha " + (document.getElementById("recaptcha_window") !== null).toString());
            if (document.getElementsByClassName('update_notification').length > 0) {
                location.reload();
            }
            if (new Date().getHours() < 6) {

            }
            if (this.UseBot == false || document.getElementById("recaptcha_window") !== null) {
                return;
            }
            let towns = ITowns.towns_collection.map(x => x);
            let massRecruit={};
            let groups=us.map(ITowns.townGroups.getGroups(),group=>{return {towns:group.towns,tasks:this.Config.Groups.find(x=>x.GroupName==group.name)}}).filter(x=>x.tasks!=undefined);
            let doRecruit=false;
            let resourceLimits=towns.map(x=>{return {townId:x.id,minwood:14500,minstone:17500,miniron:14500,maxwood:17000,maxstone:20000,maxiron:17000}})
            for (let town of towns) {
                try {
                    if(us.any(MM.getModels().Takeover,x=>x.attributes.destination_town.id==town.id))
                    {
                        console.info("conquest "+town.id+" "+town.attributes.name)
                    }
                    let group;
                    if(groups.length==0)
                    {
                        group={tasks:this.Config.Groups[0]};
                    }
                    else
                    {
                        group=groups.find(gr=>gr.towns[town.id]!=undefined);
                        if(group==undefined)
                        {
                            console.info("no Group "+town.id);
                            continue;
                        }
                    }
                    let result=await group.tasks.CheckTasks(town);
                     
                    if(result.Units)
                    {
                        doRecruit=true;
                        massRecruit[town.id]=result.Units;
                    }
                    if(result.TasksDone)
                     {
                         let limit=resourceLimits.find(x=>x.townId==town.id);
                         let minValue=town.attributes.storage*0.8;
                         let maxValue=town.attributes.storage*0.9;
                         if(town.attributes.storage<20000)
                         {
                            minValue=town.attributes.storage*0.9;
                            maxValue=town.attributes.storage;
                         }
                         limit.minwood=minValue;
                         limit.minstone=minValue;
                         limit.miniron=minValue;
                         limit.maxwood=maxValue;
                         limit.maxstone=maxValue;
                         limit.maxiron=maxValue;
                     }
                    else
                    {
                        let asdf="asdf";
                    }
                } catch (ex) {
                    console.error(ex);

                }
            }

            if(doRecruit)
            {
                await gpAjax.ajaxPost('town_overviews', 'recruit_units',{towns:massRecruit});
                console.info(massRecruit);
            }
            await this.BuildFarmTowns();
            await this.FarmTown();
            await this.StartCelebrations(Game.player_name=="suchtla95"&&false, false, false,true);
            await this.TradeInternal(resourceLimits);
            this.BotSuccessOnce=true;
        }
        catch (ex) {
            console.error(ex);
            if (this.BotSuccessOnce) {
                // location.reload();

            }
        }
    }
    async OnFavorChanged(god,favor)
    {
        if(favor<490)
        {
            return;
        }
        let towns=us.map(us.find(ITowns.townGroups.getGroups(),x=>x.name=="flying")?.towns,x=>ITowns.towns[x.id])?.filter(x=>x.god()==god);
        if(towns===undefined)
        {
            return;
        }
        for(let j=0;j<towns.length;j++)
        {
            let town=ITowns.towns_collection._byId[towns[j].id];

            if(await this.TryRecruitSpecialUnits(town,god,favor))
            {
                return;
            }
        }

    }
    SubscribeToGod(god)
    {
        let gods=us.find(MM.getModels().PlayerGods,x=>true);
        this.OnFavorChanged(god,gods.attributes[god+"_favor"]);
        gods.onGodFavorChange(gods,god,(x,y,z)=>this.OnFavorChanged(god,y))
    }

    async TryRecruitSpecialUnits(town,god,favor)
    {
        let unitInfo=Object.entries(GameData.units).find(x=>x[1].flying&&x[1].god_id==god)[1];
        if(unitInfo===undefined)
        {
            return false;
        }
        if(town.getBuildings().getBuildingLevel("barracks")<1)
        {
            return;
        }
        let buildingDependencies=Object.entries(unitInfo.building_dependencies??{});
        for(let j=0;j<buildingDependencies.length;j++)
        {
            if(town.getBuildings().getBuildingLevel(buildingDependencies[j][0])<buildingDependencies[j][1])
            {
                console.info("no recruit "+buildingDependencies[j][0]);
                return false;
            }
        }
        let existingCount=unitInfo.is_naval?ITowns.towns[town.id].getUnitOrdersCollection().getNavalUnitOrdersCount():ITowns.towns[town.id].getUnitOrdersCollection().getGroundUnitOrdersCount();
        if(existingCount>=6)
        {
            return false;
        }

        let amount=Math.floor(favor/unitInfo.favor);
        if(amount>Math.floor(town.getAvailablePopulation()/unitInfo.population))
        {
            amount=Math.floor(town.getAvailablePopulation()/unitInfo.population);
        }
        if(amount>Math.floor(town.attributes.wood/unitInfo.resources.wood))
        {
            amount=Math.floor(town.attributes.wood/unitInfo.resources.wood);
        }
        if(amount>Math.floor(town.attributes.iron/unitInfo.resources.iron))
        {
            amount=Math.floor(town.attributes.iron/unitInfo.resources.iron);
        }
        if(amount>Math.floor(town.attributes.stone/unitInfo.resources.stone))
        {
            amount=Math.floor(town.attributes.stone/unitInfo.resources.stone);
        }
        if(amount==0)
        {
            return false;
        }
        console.info("recruit town:"+town.id+", unit: "+amount+" "+unitInfo.id);
        await gpAjax.ajaxPost('building_barracks', 'build', { "unit_id":unitInfo.id,"amount":amount,"town_id":town.id });
        return true;
    }
    async StartCelebrations(party, theater, games, triumph) {
        await ITowns.townGroups.setActiveTownGroup(-1);
        if (party&&ITowns.towns_collection.any(x=>x.getBuildings().getBuildingLevel("academy")>=30&&x.attributes.wood>15000&&x.attributes.iron>15000&&x.attributes.stone>18000 && !us.any(MM.status().models.Celebration,celeb=>celeb.getTownId()==x.id&&celeb.getCelebrationType()=="party"))) {
            await gpAjax.ajaxPost('town_overviews', 'start_all_celebrations', { celebration_type: "party" });
        }
        if (theater&&ITowns.towns_collection.any(x=>x.getBuildings().getBuildingLevel("theater")==1&&x.attributes.wood>10000&&x.attributes.iron>10000&&x.attributes.stone>12000 && !us.any(MM.status().models.Celebration,celeb=>celeb.getTownId()==x.id&&celeb.getCelebrationType()=="theater"))) {
            await gpAjax.ajaxPost('town_overviews', 'start_all_celebrations', { celebration_type: "theater" });
        }
        if (games&&ITowns.towns_collection.any(x=>!us.any(MM.status().models.Celebration,celeb=>celeb.getTownId()==x.id&&celeb.getCelebrationType()=="games"))) {
            await gpAjax.ajaxPost('town_overviews', 'start_all_celebrations', { celebration_type: "games" });
        }
        if (triumph&&layout_main_controller.models.player_killpoints.getUnusedPoints()>10000&&ITowns.towns_collection.any(x=>!us.any(MM.status().models.Celebration,celeb=>celeb.getTownId()==x.id&&celeb.getCelebrationType()=="triumph"))) {
            await gpAjax.ajaxPost('town_overviews', 'start_all_celebrations', { celebration_type: "triumph" });
        }
        if(ITowns.towns_collection.any(x=>x.iron>25000)&&false)
        {
            await gpAjax.ajaxPost('town_overviews', 'store_iron_in_all_towns', { 'iron_to_keep': 25000, 'iron_to_store': 1700 }, false);
        }
    }
    async BuildFarmTowns() {
        layout_main_controller.getCollections().farm_town_player_relations.map(x => x).sort((x, y) => x.attributes.expansion_stage - y.attributes.expansion_stage).forEach(async town => {
            if (layout_main_controller.models.player_killpoints.getUnusedPoints() > 100) {
                if (town.attributes.expansion_stage < 6 && town.attributes.relation_status > 0 && town.attributes.expansion_at == null) {
                    await gpAjax.post("frontend_bridge", "execute", { "model_url": "FarmTownPlayerRelation/" + town.attributes.id, "action_name": "upgrade", "arguments": { "farm_town_id": town.attributes.farm_town_id } });
                }
                else if (town.attributes.relation_status == 0 && town.attributes.expansion_at == null) {
                    await gpAjax.post("frontend_bridge", "execute", { "model_url": "FarmTownPlayerRelation/" + town.attributes.id, "action_name": "unlock", "arguments": { "farm_town_id": town.attributes.farm_town_id } });
                }
            }
        });
    };
    async FarmTown() {
        let towns = ITowns.towns_collection.filter(function (x) {
            return (x.attributes.storage * 3 - x.attributes.resources.iron - x.attributes.resources.wood - x.attributes.resources.stone) > 100;
            if (x.attributes.storage < 10000) {
                return (x.attributes.storage * 3 - x.attributes.resources.iron - x.attributes.resources.wood - x.attributes.resources.stone) > 100;
            }
            return (x.attributes.storage * 2 - x.attributes.resources.wood - x.attributes.resources.stone) > 3000||(x.attributes.storage-x.attributes.iron)>7000;
        }).map(function (x) {
            return x.id
        });
        if (towns.length > 0) {
            await gpAjax.ajaxPost('farm_town_overviews', 'claim_loads_multiple',
                {
                    towns: towns,
                    time_option_base: "300", 
                    time_option_booty: "600", 
                    claim_factor: "normal"
                }
            );
        }
    }
    async TradeInternal(resourceLimits) {
        let resources=new Array("wood","iron","stone");
        let allMovements = JSON.parse(await gpAjax.ajaxGet('town_overviews', 'trade_overview')).json;
        let movements = JSON.parse(await gpAjax.ajaxGet('town_overviews', 'trade_overview')).json.movements.map(function (x) {
            let to = JSON.parse(atob(x.to.link.split('#')[1].split('"')[0]));
            x.idTo=to.id;
            return x;

        });
        let townData=ITowns.towns_collection.map(town=>{
            const resources=town.attributes.resources;
            movements.filter(x=>x.idTo==town.id).forEach(x=>
                {
                    for(let res in resources)
                    {
                        resources[res]+=x.res[res]
                    }
                });
            let limits=resourceLimits.find(x=>x.townId==town.id);
            let overFlow={};
            let needed={};
            let totalOverFlow=0;
            let totalNeeded=0
            for(let res in resources)
            {
                let needRes=limits["min"+res]-resources[res];
                if(needRes<500)
                {
                    needRes=0;
                }
                needed[res]=needRes;
                totalNeeded+=needRes;
                
                let overRes=resources[res]-limits["max"+res];
                if(overRes>town.attributes.resources[res])
                {
                    overRes=town.attributes.resources[res];
                }
                 if(overRes<500||town.attributes.total_trade_capacity<6000)
                {
                    overRes=0;
                }
                overFlow[res]=overRes;
                totalOverFlow+=overRes;
            }
            return{
                town:town,
                limits:limits,
                resourcesAfterMovement:resources,
                needed:needed,
                overFlow:overFlow,
                totalOverFlow:totalOverFlow,
                totalNeeded:totalNeeded
            }
        });

        const getDistance=(function(town1, town2) {
            if(!town1||!town2||!town1.attributes||!town2.attributes)
            {
                return 1000000;
            }
          const dx = town1.attributes.abs_x - town2.attributes.abs_x;
          const dy = town1.attributes.abs_y - town2.attributes.abs_y;
          return Math.sqrt(dx * dx + dy * dy);
        });

        const SendResourcesFromTown=(async function(town,allTowns)
            {
                if(town.town.attributes.available_trade_capacity<1000)
                {
                    return;
                }
                 let resources=new Array("wood","iron","stone");
                 var townsWithDistance=[...allTowns].filter(x=>x.town!=town.town)
                    .sort((a, b) => {
                      return getDistance(town.town, a.town) - getDistance(town.town, b.town);
                    });
                for(let j=0;j<townsWithDistance.length;j++)
                {
                    
                    let townReceive=townsWithDistance[j];
                    let resources=new Array("wood","iron","stone");
                    let totalSend=0;
                    let sendRes={};
                    for(let i=0;i< resources.length;i++)
                    {
                        let res=resources[i];
                        if(!town.overFlow)
                        {
                            let a="";
                        }
                        if(townReceive.needed[res]>0&&town.overFlow[res]>0)
                        {
                            sendRes[res]=townReceive.needed[res];
                            if(town.overFlow[res]<sendRes[res])
                            {
                                sendRes[res]=town.overFlow[res];
                            }
                            totalSend+=sendRes[res];
                        }
                        else
                        {
                            sendRes[res]=0;
                        }
                    }
                    if(totalSend>500)
                    {
                        if(totalSend>town.town.attributes.available_trade_capacity)
                        {
                            for(let i=0;i< resources.length;i++)
                            {
                                let res=resources[i];
                                sendRes[res]=sendRes[res]/totalSend*town.town.attributes.available_trade_capacity;
                            }
                        }
                        let sending=0;
                        for(let i=0;i< resources.length;i++)
                        {
                            let res=resources[i];
                            sendRes[res]=Math.floor(sendRes[res]);
                            
                            townReceive.needed[res]-=sendRes[res];
                            sending+=sendRes[res];
                        }
                        if(sending<100)
                        {
                            let asdf="asdf";
                        }
                        sendRes.id=townReceive.town.id;
                        sendRes.town_id=town.town.id;
                        let resp=await gpAjax.ajaxPost('town_info', 'trade',sendRes);  
                        if(!resp.includes("success"))
                        {
                            let asdf="asdf";
                        }
                        await(new Promise(resolve => setTimeout(resolve, 300)));

                        return;
                    }
                }
            });
        let giveTowns=townData.filter(x=>x.totalOverFlow>0);
        let receiveTowns=townData.filter(x=>x.totalNeeded>0);
        for(let i=0;i<giveTowns.length;i++)
        {
            let town=giveTowns[i];
           await SendResourcesFromTown(town,receiveTowns)
        }
        return;
        
    }
}
class GroupTask {
    TaskType;
    Level;
    Choice;
    constructor(taskType, choice, level, parentGroup) {
        this.TaskType = taskType;
        this.Level = level;
        this.Choice = choice;
    }
    async CheckTry(town) {
        let retVal={};
        if (this.TaskType == "build") {
            retVal= await this.CheckBuilding(town, this.Choice, this.Level);
        }
        else if (this.TaskType == "research") {
            retVal= await this.CheckResearch(town, this.Choice);
        }
        else if (this.TaskType == "deconstruct") {
            retVal= await this.CheckDeconstruct(town, this.Choice, this.Level);
        }
        retVal.Task=this;
        return retVal;
    }

    async CheckDeconstruct(town,choice,level)
    {
        let buildData = town.getBuildingBuildData(() => false);

        let buildingLevel=town.buildings().attributes[choice];

        if ((buildingLevel-us.filter(MM.getModels().BuildingOrder,order=>order.attributes.town_id==town.id&&order.attributes.tear_down&&order.attributes.building_type==choice).length) <= level) {
            return { needed: false, done: false };
        }
        if (ITowns.towns[town.id].buildingOrders().length>=6) {
            return { needed: true, done: false, canRecruit: true };
        }

        await gpAjax.ajaxPost('frontend_bridge', 'execute',
                              {
            "model_url": "BuildingOrder", "action_name": "tearDown", "arguments":
            {
                "building_id": choice
            }
            , "town_id": town.id, "nl_init": true
        });
        return { needed: true, done: true };

    }

    async CheckResearch(town, choice) {
        if (town.researches().hasResearch(choice)) {
            return { needed: false, done: false };
        }
        if(us.any(MM.getModels().ResearchOrder,x=>x.attributes.town_id==town.id&&x.attributes.research_type==choice))
        {
            return { needed: false, done: false };
        }
        let research = GameData.researches[choice];
        let buildingReq = Object.entries(research.building_dependencies);
        for (let i = 0; i < buildingReq.length; i++) {
            if (town.buildings().getBuildingLevel(buildingReq[i][0]) < buildingReq[i][1]) {
                return this.CheckBuilding(town, buildingReq[i][0], buildingReq[i][1]);
            }
        }
        if (this.GetFreeResearch(town) < research.research_points) {
            return { needed: false, done: false };
        }
        let townRes = town.getResources();
        if (research.resources.wood > townRes.wood || research.resources.iron > townRes.iron || research.resources.stone > townRes.stone) {
            return { needed: true, done: false };
        }

        await gpAjax.ajaxPost('frontend_bridge', 'execute',
                              {
            "model_url": "ResearchOrder", "action_name": "research", "arguments":
            {
                "id": choice
            }
            , "town_id": town.id, "nl_init": true
        });
        return { needed: true, done: true };
    }
    GetFreeResearch(town) {
        let totalResearchPoints = town.buildings().getBuildingLevel("academy") * GameDataResearches.getResearchPointsPerAcademyLevel();
        let researches = town.researches();
        let usedResearchPoints = Object.entries(GameData.researches).filter(x => researches.hasResearch(x[0])).map(x => x[1].research_points).reduce((partialSum, a) => partialSum + a, 0);
        return totalResearchPoints - usedResearchPoints;
    }
    async CheckBuilding(town, choice, level) {

        let buildData = town.getBuildingBuildData(() => false);
        let buildingData=buildData.getBuildingData();
        if(buildingData===undefined)
        {
            let levelIs=town.buildings().attributes[choice];
            if(levelIs>=level)
            {
                return { needed: false, done: false };
            }
            return { needed: true, done: false, canRecruit: true };
        }
        let building = buildingData[choice];
        if (building.level >= level) {
            return { needed: false, done: false };
        }
        if (buildData.getIsBuildingOrderQueueFull()) {
            return { needed: true, done: false, canRecruit: true };
        }
        if (building.can_upgrade) {
            await gpAjax.ajaxPost('frontend_bridge', 'execute',
                                  {
                "model_url": "BuildingOrder", "action_name": "buildUp", "arguments":
                {
                    "building_id": choice, "build_for_gold": false
                }
                , "town_id": town.id, "nl_init": true
            });
            return { needed: true, done: true };
        }
        if (!building.enough_storage) {
            if (buildData.getBuildingData().storage.can_upgrade) {
                await gpAjax.ajaxPost('frontend_bridge', 'execute',
                                      {
                    "model_url": "BuildingOrder", "action_name": "buildUp", "arguments":
                    {
                        "building_id": "storage", "build_for_gold": false
                    }
                    , "town_id": town.id, "nl_init": true
                });
                return { needed: true, done: true };
            }
            else {
                return { needed: true, done: false };
            }
        }

        if (town.getAvailablePopulation() <= building.population_for) {
            if (buildData.getBuildingData().farm.can_upgrade) {
                await gpAjax.ajaxPost('frontend_bridge', 'execute',
                                      {
                    "model_url": "BuildingOrder", "action_name": "buildUp", "arguments":
                    {
                        "building_id": "farm", "build_for_gold": false
                    }
                    , "town_id": town.id, "nl_init": true
                });
                return { needed: true, done: true };
            }
            else {
                return { needed: true, done: false };
            }
        }
        let missing = Object.entries(building.missing_dependencies);
        if (missing.length > 0) {
            return await this.CheckBuilding(town, missing[0][0], missing[0][1].needed_level);
        }
        if(building.special)
        {
            return { needed: false, done: false };
        }
        let costs=Object.entries(building.resources_for);
        for(let i=0;i<costs.length;i++)
        {
            if(town.attributes[costs[i][0]]<costs[i][1])
            {
                return { needed: true, done: false };
            }
        }


        await gpAjax.ajaxPost('frontend_bridge', 'execute',
                              {
            "model_url": "BuildingOrder", "action_name": "buildUp", "arguments":
            {
                "building_id": choice, "build_for_gold": false
            }
            , "town_id": town.id, "nl_init": true
        });
        return { needed: true, done: true };

    }
}
class GroupTownTasks {
    GroupName;
    Tasks = new Array(0);
    Units = new Array(0);
    SpecialUnits=new Array(0);
    SpamAttacks = new Array(0);
    constructor(groupName) {
        this.GroupName = groupName;
        this.Tasks = new Array(0);
    }
    AddBuilding(building, level) {
        this.Tasks[this.Tasks.length] = new GroupTask("build", building, level, this);
        return this;
    }
    AddResearch(research) {
        this.Tasks[this.Tasks.length] = new GroupTask("research", research, 1, this);
        return this;
    }
    AddDeconstruction(building, level) {
        this.Tasks[this.Tasks.length] = new GroupTask("deconstruct", building, level, this);
        return this;
    }
    AddUnits(priority, units) {
        this.Units[this.Units.length] = { priority: priority, units: units };
        this.Units = this.Units.sort((a, b) => a.priority - b.priority);
        return this;
    }
    AddSpamAttack(townId, units) {
        this.SpamAttacks[this.SpamAttacks.length] = { townId: townId, units: units };
        return this;
    }
    AddSpecialUnit(unitType)
    {
        this.SpecialUnits[this.SpecialUnits.length]=GameData.units[unitType];
        return this;
    }
    AddFarmUnit(unit) {
        return this;
    }
    async CheckSpamAttacks(town) {
        for (let i = 0; i < this.SpamAttacks.length; i++) {
            let attacksToSend = 10;
            let spam = this.SpamAttacks[i];
            let unitsInTown = ITowns.towns[town.id].units();
            let unitsInOrder = Object.entries(spam.units);

            for (let j = 0; j < unitsInOrder.length; j++) {
                let unitCount = unitsInTown[unitsInOrder[j][0]] ?? 0;
                //+ ITowns.towns[town.id].getUnitOrdersCollection().getNumberOfUnitsFromRunningOrders(unitsInOrder[j][0]);
                let toSend = Math.floor(unitCount / unitsInOrder[j][1])
                if (attacksToSend > toSend) {
                    attacksToSend = toSend;
                }
            }
            if (attacksToSend > 0) {
                let data = structuredClone(spam.units);
                data.town_id = town.id;
                data.id = spam.townId;
                data.type = "attack";
                data.nd_init = true;
                for (j = 0; j < attacksToSend; j++) {
                    await gpAjax.ajaxPost('town_info', 'send_units', data);
                }
                return;
            }
        }
    }
    async CheckTasks(town) {
        await this.CheckSpamAttacks(town);

        let taskRes = { needed: false, done: false };
        for (let i = 0; i < this.Tasks.length; i++) {
            taskRes = await this.Tasks[i].CheckTry(town, this);
            if (taskRes.needed) {
                break;
            }
        }

        if (taskRes.done) {
            return{TasksDone:taskRes.needed==false};
        }
        if (taskRes.needed && !taskRes.canRecruit) {

            return{TasksDone:taskRes.needed==false};
        }
        if(((town.attributes.wood*10)/town.attributes.storage)>8&&((town.attributes.iron*10)/town.attributes.storage)>8&&((town.attributes.stone*10)/town.attributes.storage)>8)
        {
            let units= await this.CheckUnits(town);
            if(units===undefined||Object.entries(units).length==0)
            {
                if(town.getBuildings().getBuildingLevel("academy")>=30&&town.attributes.wood>15000&&town.attributes.iron>15000&&town.attributes.stone>18000 && !us.any(MM.status().models.Celebration,celeb=>celeb.getTownId()==town.id&&celeb.getCelebrationType()=="party"))
                {
                    //await gpAjax.ajaxPost('town_overviews', 'start_celebration', { celebration_type: "party","town_id":town.id });
                }
                return{TasksDone:taskRes.needed==false};
            }
            return {Units:units,TasksDone:taskRes.needed==false};
        }
         return{TasksDone:taskRes.needed==false};
    }
    async CheckUnits(town)
    {
        let unitsInTown=this.GetTotalUnits(ITowns.towns[town.id]);
        for (let i = 0; i < this.Units.length; i++) {
            let recruitInfo = Object.entries(this.Units[i].units).map(x=>{return {unitType:x[0],needed:x[1],existing:(unitsInTown[x[0]]??0)}}).sort((x,y)=>(y.needed*100/y.existing)-(x.needed*100/x.existing))[0];
            if(recruitInfo.needed>recruitInfo.existing)
            {
                let unitInfo=GameData.units[recruitInfo.unitType];
                if(unitInfo.research_dependencies.length>0&&!town.researches().hasResearch(unitInfo.research_dependencies[0]))
                {
                    return;
                }
                if(unitInfo.is_naval&&town.getBuildings().getBuildingLevel("docks")<1)
                {
                    return;
                }
                if(!unitInfo.is_naval&&town.getBuildings().getBuildingLevel("barracks")<1)
                {
                    return;
                }
                let buildingDependencies=Object.entries(unitInfo.building_dependencies??{});
                for(let j=0;j<buildingDependencies.length;j++)
                {
                    if(town.getBuildings().getBuildingLevel(buildingDependencies[j][0])<buildingDependencies[j][1])
                    {
                        console.info("no recruit "+buildingDependencies[j][0]);
                        return;
                    }
                }
                let existingCount=unitInfo.is_naval?ITowns.towns[town.id].getUnitOrdersCollection().getNavalUnitOrdersCount():ITowns.towns[town.id].getUnitOrdersCollection().getGroundUnitOrdersCount();
                if(existingCount>=6)
                {
                    return;
                }
                let amount=recruitInfo.needed-recruitInfo.existing;
                if(amount>Math.floor(town.getAvailablePopulation()/unitInfo.population))
                {
                    amount=Math.floor(town.getAvailablePopulation()/unitInfo.population);
                }
                if(amount>Math.floor(town.attributes.wood/unitInfo.resources.wood))
                {
                    amount=Math.floor(town.attributes.wood/unitInfo.resources.wood);
                }
                if(amount>Math.floor(town.attributes.iron/unitInfo.resources.iron))
                {
                    amount=Math.floor(town.attributes.iron/unitInfo.resources.iron);
                }
                if(amount>Math.floor(town.attributes.stone/unitInfo.resources.stone))
                {
                    amount=Math.floor(town.attributes.stone/unitInfo.resources.stone);
                }
                if(amount==0)
                {
                    return;
                }
                let retVal={};
                retVal[recruitInfo.unitType]=amount;
                return retVal;
            }
        }
    }
    GetTotalUnits(townObj)
    {
        let unitsInTown=Object.entries(townObj.units());
        let unitsOuter=Object.entries(townObj.unitsOuter());
        let unitOrders=townObj.getUnitOrdersCollection().getAllOrders();
        let retVal=new Object();
        for(let i =0;i<unitsInTown.length;i++)
        {
            retVal[unitsInTown[i][0]]=(retVal[unitsInTown[i][0]]??0)+unitsInTown[i][1];
        }
        for(i =0;i<unitsOuter.length;i++)
        {
            retVal[unitsOuter[i][0]]=(retVal[unitsOuter[i][0]]??0)+unitsOuter[i][1];
        }
        for(i=0;i<unitOrders.length;i++)
        {
            retVal[unitOrders[i].attributes.unit_type]=(retVal[unitOrders[i].attributes.unit_type]??0)+unitOrders[i].attributes.units_left;
        }
        return retVal;
    }
}
