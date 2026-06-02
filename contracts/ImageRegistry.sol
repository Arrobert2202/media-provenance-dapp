// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// on-chain registry that stores a perceptual hash + metadata for each anchored image
contract ImageRegistry {

    // each record holds the hash, who submitted it, when, and a text description
    struct ImageRecord {
        string phash;
        address author;
        uint256 timestamp;
        string context;
    }

    // all records stored in order of insertion
    ImageRecord[] private records;

    // quick lookup to prevent the same hash being anchored twice
    mapping(string => bool) public hasBeenAnchored;

    // fired every time a new image is successfully anchored
    event ImageAnchored(
        uint256 indexed recordIndex,
        string phash,
        address indexed author,
        uint256 timestamp,
        string context
    );

    // store a new image hash on-chain with its context metadata
    function anchorImage(
        string memory _phash,
        string memory _context
    ) external {
        require(bytes(_phash).length > 0, "pHash cannot be empty");
        require(!hasBeenAnchored[_phash], "pHash already anchored");

        // mark as anchored so duplicates are rejected
        hasBeenAnchored[_phash] = true;

        // append the new record to the array
        records.push(ImageRecord({
            phash: _phash,
            author: msg.sender,
            timestamp: block.timestamp,
            context: _context
        }));

        // emit event so off-chain clients can index it
        emit ImageAnchored(
            records.length - 1,
            _phash,
            msg.sender,
            block.timestamp,
            _context
        );
    }

    // read-only — returns the full registry so the backend can do hamming comparisons
    function getAllRecords() external view returns (ImageRecord[] memory) {
        return records;
    }

    // convenience function to check how many images have been anchored
    function getRecordCount() external view returns (uint256) {
        return records.length;
    }
}
