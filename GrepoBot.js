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
        var SpamDestinations={TinyAlpaca:{de155:13722,de157:3428},suchtla95:{}};

        window.GrepoBot = this;
        
        this.SubscribeToGod("ares");
        this.SubscribeToGod("zeus");
        this.SubscribeToGod("hera");
        this.SubscribeToGod("artemis");

    }
    async DoIt()
    {
        setTimeout(this.DoIt, 602000);
        this.RunBot();
    }
    async DoItQueue()
    {
        setTimeout(this.DoItQueue, 10000);
        if(!config.DoQueue)
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
        var finishBuildOrder=async function(order){

            var data={
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
            var towns = ITowns.towns_collection.map(x => x);
            var massRecruit={};
            var groups=us.map(ITowns.townGroups.getGroups(),group=>{return {towns:group.towns,tasks:config.Groups.find(x=>x.GroupName==group.name)}}).filter(x=>x.tasks!=undefined);
            var doRecruit=false;
            for (var i = 0; i < towns.length; i++) {
                try {
                    var town=towns[i];
                    if(us.any(MM.getModels().Takeover,x=>x.attributes.destination_town.id==town.id))
                    {
                        console.info("conquest "+town.id+" "+town.attributes.name)
                    }
                    var group
                    if(groups.length==0)
                    {
                        group={tasks:config.Groups[0]};
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
                    var recruit=await group.tasks.CheckTasks(town);
                    if(recruit)
                    {
                        doRecruit=true;
                        massRecruit[town.id]=recruit;
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
            await this.TradeInternal();
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
        var towns=us.map(us.find(ITowns.townGroups.getGroups(),x=>x.name=="flying")?.towns,x=>ITowns.towns[x.id])?.filter(x=>x.god()==god);
        if(towns===undefined)
        {
            return;
        }
        for(var j=0;j<towns.length;j++)
        {
            var town=ITowns.towns_collection._byId[towns[j].id];

            if(await this.TryRecruitSpecialUnits(town,god,favor))
            {
                return;
            }
        }

    }
    SubscribeToGod(god)
    {
        var gods=us.find(MM.getModels().PlayerGods,x=>true);
        this.OnFavorChanged(god,gods.attributes[god+"_favor"]);
        gods.onGodFavorChange(gods,god,(x,y,z)=>this.OnFavorChanged(god,y))
    }

    async TryRecruitSpecialUnits(town,god,favor)
    {
        var unitInfo=Object.entries(GameData.units).find(x=>x[1].flying&&x[1].god_id==god)[1];
        if(unitInfo===undefined)
        {
            return false;
        }
        if(town.getBuildings().getBuildingLevel("barracks")<1)
        {
            return;
        }
        var buildingDependencies=Object.entries(unitInfo.building_dependencies??{});
        for(var j=0;j<buildingDependencies.length;j++)
        {
            if(town.getBuildings().getBuildingLevel(buildingDependencies[j][0])<buildingDependencies[j][1])
            {
                console.info("no recruit "+buildingDependencies[j][0]);
                return false;
            }
        }
        var existingCount=unitInfo.is_naval?ITowns.towns[town.id].getUnitOrdersCollection().getNavalUnitOrdersCount():ITowns.towns[town.id].getUnitOrdersCollection().getGroundUnitOrdersCount();
        if(existingCount>=6)
        {
            return false;
        }

        var amount=Math.floor(favor/unitInfo.favor);
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
        var towns = ITowns.towns_collection.filter(function (x) {
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
                time_option_base: "300", time_option_booty: "600", claim_factor: "normal"
            }
                                 );
        }
    }
    async TradeInternal() {
        var allMovements = JSON.parse(await gpAjax.ajaxGet('town_overviews', 'trade_overview')).json;
        var movements = JSON.parse(await gpAjax.ajaxGet('town_overviews', 'trade_overview')).json.movements.map(function (x) {
            var to = JSON.parse(atob(x.to.link.split('#')[1].split('"')[0]));
            x.idTo=to.id;
            return x;

        });

        var giveWood = ITowns.towns_collection.filter(function (x) {
            var tradeMovements = movements.filter(y => y.idTo == x.attributes.id);
            var wood = x.attributes.resources.wood;
            tradeMovements.forEach(trade => {
                wood += trade.res.wood;

            });
            if (x.attributes.max_trade_capacity < 2500) {
                return false;

            }
            x.wood = wood;
            if (x.attributes.available_population > 100) {
                return x.attributes.resources.wood > 25000
            }
            return x.attributes.resources.wood > 21000;

        }
                                                     ).map(function (x) {
            var amount = x.attributes.resources.wood - 20000;
            if (x.attributes.available_population > 100) {
                amount = x.attributes.resources.wood - 24000;

            }
            return { id: x.id, amount: amount, town: x };

        }
                                                          ).sort(function (x, y) {
            return y.amount - x.amount
        }
                                                                );

        var getWood = ITowns.towns_collection.filter(function (x) {
            if (x.attributes.storage < 18000) {
                return x.wood < (x.attributes.storage - 2000);

            }
            return x.wood < 18000
        }
                                                    ).map(function (x) {
            if (x.attributes.storage < 18000) {
                return { id: x.id, amount: x.attributes.storage - x.wood - 2000, town: x };

            }
            return { id: x.id, amount: 18000 - x.wood, town: x };
        }
                                                         );
        for (var i = 0; i < giveWood.length; i++) {
            if (getWood.length == 0) {
                continue;

            }
            getWood = getWood.sort(function (x, y) {
                return y.amount - x.amount
            }
                                  );
            var getIt = getWood[0];
            var send = giveWood[i];
            var amount = send.town.attributes.max_trade_capacity / 3;
            if (amount <= 1000) {
                amount = send.town.attributes.max_trade_capacity;

            }
            if (getIt.amount < amount) {
                amount = getIt.amount;

            }
            if (send.town.attributes.available_trade_capacity < amount) {
                amount = send.town.attributes.available_trade_capacity;

            }
            if (send.amount < amount) {
                amount = send.amount;

            }
            if (amount >= 5000) {
                console.info(send.town.getName() + " to " + getIt.town.getName() + amount + " wood");
                await gpAjax.ajaxPost('town_info', 'trade',
                                      {
                    id: getIt.id, wood: amount, stone: 0, iron: 0, town_id: send.id
                }
                                     );
                getIt.amount -= amount;

            }

        }

        var giveStone = ITowns.towns_collection.filter(function (x) {
            var tradeMovements = movements.filter(y => y.idTo == x.attributes.id);
            var stone = x.attributes.resources.stone;
            tradeMovements.forEach(trade => {
                stone += trade.res.stone;

            }
                                  );
            if (x.attributes.max_trade_capacity < 2500) {
                return false;

            }
            x.stone = stone;
            if (x.attributes.available_population > 100) {
                return x.attributes.resources.stone > 25000
            }
            return x.attributes.resources.stone > 21000;

        }
                                                      ).map(function (x) {
            var amount = x.attributes.resources.stone - 20000;
            if (x.attributes.available_population > 100) {
                amount = x.attributes.resources.stone - 24000;

            }
            return { id: x.id, amount: amount, town: x };

        }
                                                           ).sort(function (x, y) { return y.amount - x.amount });
        var getStone = ITowns.towns_collection.filter(function (x) {
            if (x.attributes.storage < 18000) {
                return x.stone < (x.attributes.storage - 2000);

            }
            return x.stone < 18000;

        }
                                                     ).map(function (x) {
            if (x.attributes.storage < 18000) {
                return { id: x.id, amount: x.attributes.storage - x.stone - 2000, town: x };

            }
            return { id: x.id, amount: 18000 - x.stone, town: x }
        });
        for (i = 0; i < giveStone.length; i++) {
            if (getStone.length == 0) {
                continue;
            }
            getStone = getStone.sort(function (x, y) {
                return y.amount - x.amount
            }
                                    );
            getIt = getStone[0];
            send = giveStone[i];
            amount = send.town.attributes.max_trade_capacity / 3;
            if (amount <= 1000) {
                amount = send.town.attributes.max_trade_capacity;

            }
            if (getIt.amount < amount) {
                amount = getIt.amount;

            }
            if (send.town.attributes.available_trade_capacity < amount) {
                amount = send.town.attributes.available_trade_capacity;

            }
            if (send.amount < amount) {
                amount = send.amount;

            }
            if (amount >= 5000) {
                console.info(send.town.getName() + " to " + getIt.town.getName() + " -> " + amount + " stone");
                await gpAjax.ajaxPost('town_info', 'trade',
                                      {
                    id: getIt.id, stone: amount, wood: 0, iron: 0, town_id: send.id
                }
                                     );
                getIt.amount -= amount;

            }

        }

        var giveIron = ITowns.towns_collection.filter(function (x) {
            var tradeMovements = movements.filter(y => y.idTo == x.attributes.id);
            var iron = x.attributes.resources.iron;
            tradeMovements.forEach(trade => {
                iron += trade.res.iron;

            }
                                  );
            if (x.attributes.max_trade_capacity < 2500) {
                return false;

            }
            x.iron = iron;
            if (x.attributes.available_population > 100) {
                return x.attributes.resources.iron > 25000
            }
            return x.attributes.resources.iron > 21000;

        }
                                                     ).map(function (x) {
            var amount = x.attributes.resources.iron - 20000;
            if (x.attributes.available_population > 100) {
                amount = x.attributes.resources.iron - 24000;

            }
            return { id: x.id, amount: amount, town: x };

        }
                                                          ).sort(function (x, y) {
            return y.amount - x.amount
        }
                                                                );
        ;
        var getIron = ITowns.towns_collection.filter(function (x) {
            if (x.attributes.storage < 18000) {
                return x.iron < (x.attributes.storage - 2000);

            }
            return x.iron < 18000;

        }
                                                    ).map(function (x) {
            if (x.attributes.storage < 18000) {
                return { id: x.id, amount: x.attributes.storage - x.iron - 1000, town: x };
            }
            return { id: x.id, amount: 18000 - x.iron, town: x };

        });
        for (i = 0; i < giveIron.length; i++) {
            if (getIron.length == 0) {
                continue;

            }
            getIron = getIron.sort(function (x, y) {
                return y.amount - x.amount
            }
                                  );
            getIt = getIron[0];
            send = giveIron[i];
            amount = send.town.attributes.max_trade_capacity / 3;
            if (amount <= 1000) {
                amount = send.town.attributes.max_trade_capacity;

            }
            if (getIt.amount < amount) {
                amount = getIt.amount;

            }
            if (send.town.attributes.available_trade_capacity < amount) {
                amount = send.town.attributes.available_trade_capacity;

            }
            if (send.amount < amount) {
                amount = send.amount;

            }
            if (amount >= 5000) {
                console.info(send.town.getName() + " to " + getIt.town.getName() + amount + " iron");
                await gpAjax.ajaxPost('town_info', 'trade',
                                      {
                    id: getIt.id, iron: amount, wood: 0, stone: 0, town_id: send.id
                }
                                     );
                getIt.amount -= amount;

            }
        }
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
        if (this.TaskType == "build") {
            return await this.CheckBuilding(town, this.Choice, this.Level);
        }
        else if (this.TaskType == "research") {
            return await this.CheckResearch(town, this.Choice);
        }
        else if (this.TaskType == "deconstruct") {
            return await this.CheckDeconstruct(town, this.Choice, this.Level);
        }
    }

    async CheckDeconstruct(town,choice,level)
    {
        var buildData = town.getBuildingBuildData(() => false);

        var buildingLevel=town.buildings().attributes[choice];

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
        var research = GameData.researches[choice];
        var buildingReq = Object.entries(research.building_dependencies);
        for (var i = 0; i < buildingReq.length; i++) {
            if (town.buildings().getBuildingLevel(buildingReq[i][0]) < buildingReq[i][1]) {
                return this.CheckBuilding(town, buildingReq[i][0], buildingReq[i][1]);
            }
        }
        if (this.GetFreeResearch(town) < research.research_points) {
            return { needed: false, done: false };
        }
        var townRes = town.getResources();
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
        var totalResearchPoints = town.buildings().getBuildingLevel("academy") * GameDataResearches.getResearchPointsPerAcademyLevel();
        var researches = town.researches();
        var usedResearchPoints = Object.entries(GameData.researches).filter(x => researches.hasResearch(x[0])).map(x => x[1].research_points).reduce((partialSum, a) => partialSum + a, 0);
        return totalResearchPoints - usedResearchPoints;
    }
    async CheckBuilding(town, choice, level) {

        var buildData = town.getBuildingBuildData(() => false);
        var buildingData=buildData.getBuildingData();
        if(buildingData===undefined)
        {
            var levelIs=town.buildings().attributes[choice];
            if(levelIs>=level)
            {
                return { needed: false, done: false };
            }
            return { needed: true, done: false, canRecruit: true };
        }
        var building = buildingData[choice];
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
        var missing = Object.entries(building.missing_dependencies);
        if (missing.length > 0) {
            return await this.CheckBuilding(town, missing[0][0], missing[0][1].needed_level);
        }
        if(building.special)
        {
            return { needed: false, done: false };
        }
        var costs=Object.entries(building.resources_for);
        for(var i=0;i<costs.length;i++)
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
        for (var i = 0; i < this.SpamAttacks.length; i++) {
            var attacksToSend = 10;
            var spam = this.SpamAttacks[i];
            var unitsInTown = ITowns.towns[town.id].units();
            var unitsInOrder = Object.entries(spam.units);

            for (var j = 0; j < unitsInOrder.length; j++) {
                var unitCount = unitsInTown[unitsInOrder[j][0]] ?? 0;
                //+ ITowns.towns[town.id].getUnitOrdersCollection().getNumberOfUnitsFromRunningOrders(unitsInOrder[j][0]);
                var toSend = Math.floor(unitCount / unitsInOrder[j][1])
                if (attacksToSend > toSend) {
                    attacksToSend = toSend;
                }
            }
            if (attacksToSend > 0) {
                var data = structuredClone(spam.units);
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

        var taskRes = { needed: false, done: false };
        for (var i = 0; i < this.Tasks.length; i++) {
            taskRes = await this.Tasks[i].CheckTry(town, this);
            if (taskRes.needed) {
                break;
            }
        }

        if (taskRes.done) {
            return;
        }
        if (taskRes.needed && !taskRes.canRecruit) {

            return;
        }
        if(((town.attributes.wood*10)/town.attributes.storage)>8&&((town.attributes.iron*10)/town.attributes.storage)>8&&((town.attributes.stone*10)/town.attributes.storage)>8)
        {
            var units= await this.CheckUnits(town);
            if(units===undefined||Object.entries(units).length==0)
            {
                if(town.getBuildings().getBuildingLevel("academy")>=30&&town.attributes.wood>15000&&town.attributes.iron>15000&&town.attributes.stone>18000 && !us.any(MM.status().models.Celebration,celeb=>celeb.getTownId()==town.id&&celeb.getCelebrationType()=="party"))
                {
                    await gpAjax.ajaxPost('town_overviews', 'start_celebration', { celebration_type: "party","town_id":town.id });
                }
            }
            return units;
        }
    }
    async CheckUnits(town)
    {
        var unitsInTown=this.GetTotalUnits(ITowns.towns[town.id]);
        for (var i = 0; i < this.Units.length; i++) {
            var recruitInfo = Object.entries(this.Units[i].units).map(x=>{return {unitType:x[0],needed:x[1],existing:(unitsInTown[x[0]]??0)}}).sort((x,y)=>(y.needed*100/y.existing)-(x.needed*100/x.existing))[0];
            if(recruitInfo.needed>recruitInfo.existing)
            {
                var unitInfo=GameData.units[recruitInfo.unitType];
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
                var buildingDependencies=Object.entries(unitInfo.building_dependencies??{});
                for(var j=0;j<buildingDependencies.length;j++)
                {
                    if(town.getBuildings().getBuildingLevel(buildingDependencies[j][0])<buildingDependencies[j][1])
                    {
                        console.info("no recruit "+buildingDependencies[j][0]);
                        return;
                    }
                }
                var existingCount=unitInfo.is_naval?ITowns.towns[town.id].getUnitOrdersCollection().getNavalUnitOrdersCount():ITowns.towns[town.id].getUnitOrdersCollection().getGroundUnitOrdersCount();
                if(existingCount>=6)
                {
                    return;
                }
                var amount=recruitInfo.needed-recruitInfo.existing;
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
                var retVal={};
                retVal[recruitInfo.unitType]=amount;
                return retVal;
            }
        }
    }
    GetTotalUnits(townObj)
    {
        var unitsInTown=Object.entries(townObj.units());
        var unitsOuter=Object.entries(townObj.unitsOuter());
        var unitOrders=townObj.getUnitOrdersCollection().getAllOrders();
        var retVal=new Object();
        for(var i =0;i<unitsInTown.length;i++)
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

