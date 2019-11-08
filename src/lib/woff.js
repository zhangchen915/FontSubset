/**
 * Created by Onur Demiralay
 * MIT License Copyright(c) 2014 Onur Demiralay
 *
 * sfnt2woff & woff2sfnt converter based on http://people.mozilla.org/~jkew/woff/woff-2009-09-16.html
 */

//TODO: Create test suites using Unit.js
//TODO: Implement metadata and private data options. (Test these as well)

import pako from 'pako'
import {Buffer} from 'buffer'

//given bit, do 4byte alignment by finding the nearest number that's divisible by 4.
function fourByteAlign(bit) {
    return (bit + 3) & ~3;
}

/* Validates 4bytealigned checksum against original checksum */
function validateCheckSums(csum1, csum2) {
    if (csum1 !== csum2) {
        //console.log("mismatch!");
        throw 'Checksum Mismatch!';
    }
}

/* 64-bit unsigned number emulator, if num overflow or underflow, it'll make the necessary adjustments.  */
function convertULong(num) {
    return num >>> 64;
}

/* Calculates checksum for 4byte aligned data */
function calcCheckSum(tableDirEntry, sfntBuf) {
    let offset = tableDirEntry.offset;
    let length = fourByteAlign(tableDirEntry.length);
    let csum = 0;
    for (let i = 0; i < length; i += 4) {
        let data = sfntBuf.readUInt32BE(offset + i);
        csum = convertULong(data + csum); //((data + csum) % 0x100000000); //emulating unsigned 32 bit integer.
    }
    /* If it's the header, then find checksumadjustment and substract from checksumAdj to find the actual checksum. */
    if (tableDirEntry.tag === 1751474532 || tableDirEntry.tag === 1651008868) { //1751474532 in decimal is 'head' in ascii 1651008868 is 'bhed' in decimal
        let checkSumAdjustment = sfntBuf.readUInt32BE(offset + 2 * 4); //2nd val is the check sum adjustment
        csum = convertULong(csum - checkSumAdjustment);
    }
    return csum;
}

/* Constructs the WOFF data by concatenating WOFF Buffers
 * Here's a top down structure: Header <- TableDir <- Table Data
 */
function constructWOFF(WOFFHeader, WOFFTableDir, WOFFTableData, WOFFSize) {
    let WOFF = Buffer.concat([WOFFHeader, WOFFTableDir]);
    for (let i = 0; i < WOFFTableData.length; ++i) {
        WOFF = Buffer.concat([WOFF, WOFFTableData[i]]);
    }
    /* Throw an exception if the WOFF's size doesn't match the size specified in the header */
    if (WOFF.length !== WOFFSize) {
        throw "Error occurred while constructing WOFF! WOFF size doesn't match the size specified in the header! " + WOFF.length + " != " + WOFFSize;
    }
    //console.log(WOFF.length + " == " + WOFFSize);
    return WOFF;
}

/* Copies the contents of buf1 to buf2
 * This function assumes alignedLen will always be bigger or equal to buf's length.
 */
function fourByteAlignedBuffer(buf, len) {
    let alignedLen = fourByteAlign(len);
    //console.log("long aligned length: " + alignedLen);
    let woffData = new Buffer(alignedLen);
    let zeroPaddedLen = alignedLen - buf.length;
    for (let i = 0; i < buf.length; ++i) {
        //console.log(buf[i]);
        woffData[i] = buf[i];
    }
    //extra bytes zero padded
    for (let i = 0; i < zeroPaddedLen; ++i) {
        woffData[buf.length + i] = 0;
    }
    return woffData;
}

//TODO:DEPRICATED! DELETE THIS FUNCTION
/* Converts Buffer to Uint8Array */
function toArrayBuffer(buf) {
    let arrBuf = new ArrayBuffer(buf.length);
    let view = new Uint8Array(arrBuf);
    for (let i = 0; i < buf.length; ++i) {
        view[i] = buf[i];
    }
    return arrBuf;
}

/*The sfnt based font specifications require that the table directory entries are sorted in ascending order of tag value.
* comparator function for sort() function.
* */
function tagComparison(entry1, entry2) {
    let tag1Str = entry1.tag.toString();
    let tag2Str = entry2.tag.toString();

    if (tag1Str < tag2Str) {
        return -1;
    }
    if (tag1Str > tag2Str) {
        return 1;
    }
    return 0;
}

/* Constructs the WOFF Header, This version does not support metadata or private data.
 * if you wish to add support make sure to add necessary changes to the header
 * TODO: Find out if we're suppose to use sfnt versions as woff versions
 */
function constructWOFFHeader(flavor, woffLen, numTables, totalSfntSize) {
    let WOFF_HEADER_LENGTH = 44;
    let WOFF_SIGNATURE = 0x774F4646;
    let WOFFHeader = new Buffer(WOFF_HEADER_LENGTH);

    WOFFHeader.writeUInt32BE(WOFF_SIGNATURE, 0); //Woff Signature
    WOFFHeader.writeUInt32BE(flavor, 4); //Flavor
    WOFFHeader.writeUInt32BE(woffLen, 8); //Woff Length
    WOFFHeader.writeUInt16BE(numTables, 12); //Woff Number of Tables
    WOFFHeader.writeUInt16BE(0, 14); //Woff Reserved (Always set to 0)
    WOFFHeader.writeUInt32BE(totalSfntSize, 16); //Woff Total SFNT Size
    WOFFHeader.writeUInt16BE(0, 20); //Woff Major Version
    WOFFHeader.writeUInt16BE(0, 22); //Woff Minor Version
    WOFFHeader.writeUInt32BE(0, 24); //Woff Meta Offset
    WOFFHeader.writeUInt32BE(0, 28); //Woff Meta Length
    WOFFHeader.writeUInt32BE(0, 32); //Woff Meta Original Length (uncompressed size of meta block)
    WOFFHeader.writeUInt32BE(0, 36); //Woff Private Offset
    WOFFHeader.writeUInt32BE(0, 40); //Woff Private Length
    return WOFFHeader;
}

/* Given sfnt (.otf, .ttf) converts it to .woff format.
 * converter is based on http://people.mozilla.org/~jkew/woff/woff-2009-09-16.html
 * */
export function sfnt2woff(sfnt) {
    let sfntBuffer = new Buffer(sfnt);
    let tableDirectory = [];

    let SFNT_TABLE_DIR_SIZE = 16; /* 4byte for each tag, checksum, offset, length */
    let SFNT_HEADER_LENGTH = 12; /* 2 byte for each numTables, searchRange, entrySelector, rangeShift, 4 byte for version*/
    let WOFF_TABLE_DIR_SIZE = 20;
    let WOFF_HEADER_LENGTH = 44;

    let numTables = sfntBuffer.readUInt16BE(4);
    let flavor = sfntBuffer.readUInt32BE(0);
    let totalSfntSize = (numTables * SFNT_TABLE_DIR_SIZE) + SFNT_HEADER_LENGTH; //total expected size of decoded font.
    //let checkSumAdjustment = 0;

    /* Table directory entries start after sfnt header, each entry consist of tag, offset, length, checksum. */
    for (let i = 0; i < numTables; ++i) {
        let next = SFNT_HEADER_LENGTH + (i * SFNT_TABLE_DIR_SIZE);
        //Read SFNT Table Directory entries
        let tableDirectoryEntry = {
            tag: sfntBuffer.readUInt32BE(next),
            checksum: sfntBuffer.readUInt32BE(next + 4),
            offset: sfntBuffer.readUInt32BE(next + 8),
            length: sfntBuffer.readUInt32BE(next + 12)
        };
        /*
         console.log("tag: " + tableDirectoryEntry.tag.toString(16));
         console.log("checksum: " + tableDirectoryEntry.checksum.toString(16));
         console.log("offset: " + tableDirectoryEntry.offset.toString(16));
         console.log("length: " + tableDirectoryEntry.length.toString(16));
         */
        tableDirectory.push(tableDirectoryEntry);
    }

    /* This might not be needed, sfnt directory should already be sorted by tag. */
    tableDirectory = tableDirectory.sort(tagComparison);

    /* Table Directory Size = numTables * is calculated by multiplying the numTables value in the WOFF header times the size of a single WOFF table directory */
    let woffTableSize = numTables * WOFF_TABLE_DIR_SIZE;
    let woffTableOffset = WOFF_HEADER_LENGTH + woffTableSize; //table dir field starts right after header field.

    let WOFFTableDir = new Buffer(woffTableSize);
    let WOFFTableData = []; //contains all the font data for every table.


    /* construct WOFF Table Directory */
    for (let i = 0; i < numTables; ++i) {
        let tableDirectoryEntry = tableDirectory[i];

        /* calculate checksum for each table and check for mismatch */
        let csum = calcCheckSum(tableDirectoryEntry, sfntBuffer);
        validateCheckSums(csum, tableDirectoryEntry.checksum);

        /* sfnt header tag! */
        /*
         if (tableDirectoryEntry.tag === 1751474532 || tableDirectoryEntry.tag === 1651008868) {
         //flavor = sfntBuffer.readUInt32BE(tableDirectoryEntry.offset); //won't work if it's otf
         //checkSumAdjustment = sfntBuffer.readUInt32BE(tableDirectoryEntry.offset + 2 * 4);
         } */
        totalSfntSize += fourByteAlign(tableDirectoryEntry.length);
        let end = tableDirectoryEntry.offset + tableDirectoryEntry.length;
        let start = tableDirectoryEntry.offset;

        /* Slice the buffer to get the data for current table. */
        let sfntSlice = sfntBuffer.slice(start, end);

        //compress the data
        let compSfntData = pako.deflate(sfntSlice);
        let compLength = sfntSlice.length < compSfntData.length ? sfntSlice.length : compSfntData.length;
        let woffDataEntry = fourByteAlignedBuffer(sfntSlice, compLength);

        /* if compressed data is equal or larger than uncompressed, use uncompressed data. */
        if (compSfntData.length >= sfntSlice.length) {
            woffDataEntry = fourByteAlignedBuffer(sfntSlice, compLength);
        } else {
            woffDataEntry = fourByteAlignedBuffer(compSfntData, compLength);
        }

        /*Construct Woff Table Directory, WoffTableDir = tag, offset,  compressed length, length, checksum (in that order)*/
        WOFFTableDir.writeUInt32BE(tableDirectoryEntry.tag, i * WOFF_TABLE_DIR_SIZE);
        WOFFTableDir.writeUInt32BE(woffTableOffset, i * WOFF_TABLE_DIR_SIZE + 4);
        WOFFTableDir.writeUInt32BE(compLength, i * WOFF_TABLE_DIR_SIZE + 8);
        WOFFTableDir.writeUInt32BE(tableDirectoryEntry.length, i * WOFF_TABLE_DIR_SIZE + 12);
        WOFFTableDir.writeUInt32BE(tableDirectoryEntry.checksum, i * WOFF_TABLE_DIR_SIZE + 16);

        woffTableOffset += woffDataEntry.length; //update woff offset.
        WOFFTableData.push(woffDataEntry);
    }

    let WOFFHeader = constructWOFFHeader(flavor, woffTableOffset, numTables, totalSfntSize);
    return constructWOFF(WOFFHeader, WOFFTableDir, WOFFTableData, woffTableOffset);
}
