// Auto-generated code. Do not edit.
namespace myTiles {
    //% fixedInstance jres blockIdentity=images._tile
    export const transparency16 = image.ofBuffer(hex``);
    //% fixedInstance jres blockIdentity=images._tile
    export const tile1 = image.ofBuffer(hex``);
    //% fixedInstance jres blockIdentity=images._tile
    export const tile2 = image.ofBuffer(hex``);
    //% fixedInstance jres blockIdentity=images._tile
    export const tile3 = image.ofBuffer(hex``);
    //% fixedInstance jres blockIdentity=images._tile
    export const tile4 = image.ofBuffer(hex``);
    //% fixedInstance jres blockIdentity=images._tile
    export const tile5 = image.ofBuffer(hex``);
    //% fixedInstance jres blockIdentity=images._tile
    export const tile6 = image.ofBuffer(hex``);

    helpers._registerFactory("tilemap", function(name: string) {
        switch(helpers.stringTrim(name)) {
            case "level1":
            case "level1":return tiles.createTilemap(hex`0f0010000e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0a0808080808080808080808090e0e070c0101120101010101010f0b0e0e070b161705050505050505070b0e0e070b050a08080808080905070b0e0e070b05070a080808090605070b0e0e070b0507130a08090b0b05070b0e0e070b0507070301040b0b05070b0e0e070b050703010101040b05070b0e0e0706050301110d11010405070b0e0e070b050505050505051715070b0e0e07020808091405140a0808100b0e0e030101120414051403010112040e0e0e0e0e0e0e0e140e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e`, img`
. . . . . . . . . . . . . . . 
. 2 2 2 2 2 2 2 2 2 2 2 2 2 . 
. 2 2 . . . . . . . . . 2 2 . 
. 2 2 . . . . . . . . . 2 2 . 
. 2 2 . 2 2 2 2 2 2 2 . 2 2 . 
. 2 2 . 2 2 2 2 2 2 2 . 2 2 . 
. 2 2 . 2 2 2 2 2 2 2 . 2 2 . 
. 2 2 . 2 2 2 2 2 2 2 . 2 2 . 
. 2 2 . 2 2 2 2 2 2 2 . 2 2 . 
. 2 2 . . . . . . . . . 2 2 . 
. 2 2 . . . . . . . . . 2 2 . 
. 2 2 2 2 2 . . . 2 2 2 2 2 . 
. . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . 
`, [myTiles.transparency16,sprites.dungeon.purpleOuterNorth0,sprites.dungeon.purpleOuterSouthEast,sprites.dungeon.purpleInnerSouthWest,sprites.dungeon.purpleInnerSouthEast,sprites.dungeon.floorDark0,sprites.dungeon.purpleOuterWest1,sprites.dungeon.purpleOuterEast1,sprites.dungeon.purpleOuterSouth1,sprites.dungeon.purpleInnerNorthEast,sprites.dungeon.purpleInnerNorthWest,sprites.dungeon.purpleOuterWest0,sprites.dungeon.purpleOuterNorthWest,sprites.dungeon.doorOpenNorth,sprites.castle.tileDarkGrass1,sprites.dungeon.purpleOuterNorthEast,sprites.dungeon.purpleOuterSouthWest,sprites.dungeon.purpleOuterNorth2,sprites.dungeon.purpleOuterNorth1,sprites.dungeon.purpleOuterEast0,sprites.dungeon.floorDarkDiamond,sprites.dungeon.floorDark3,sprites.dungeon.floorDark1,sprites.dungeon.floorDark4,myTiles.tile5], TileScale.Sixteen);
        }
        return null;
    })

    helpers._registerFactory("tile", function(name: string) {
        switch(helpers.stringTrim(name)) {
            case "baseTransparency16":
            case "transparency16":return transparency16;
            case "myTile5":
            case "tile1":return tile1;
            case "myTile6":
            case "tile2":return tile2;
            case "myTile7":
            case "tile3":return tile3;
            case "myTile8":
            case "tile4":return tile4;
            case "myTile":
            case "tile5":return tile5;
            case "myTile0":
            case "tile6":return tile6;
        }
        return null;
    })

}
// Auto-generated code. Do not edit.
