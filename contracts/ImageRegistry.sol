// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title ImageRegistry
 * @notice On-chain registry for perceptual-hash anchoring.
 *         Stores pHash + metadata so the Node.js backend can fetch all
 *         records and compute Hamming distance off-chain.
 */
contract ImageRegistry {
    struct ImageRecord {
        string phash;
        address author;
        uint256 timestamp;
        string context;
    }

    /// @dev Append-only record store.
    ImageRecord[] private records;

    /// @notice Prevents double-anchoring of the same pHash.
    mapping(string => bool) public hasBeenAnchored;

    event ImageAnchored(
        uint256 indexed recordIndex,
        string phash,
        address indexed author,
        uint256 timestamp,
        string context
    );

    /**
     * @notice Anchor a new image record on-chain.
     * @param _phash   The perceptual hash of the image (hex string).
     * @param _context Free-text context (e.g. caption, location, event).
     */
    function anchorImage(
        string memory _phash,
        string memory _context
    ) external {
        require(bytes(_phash).length > 0, "pHash cannot be empty");
        require(!hasBeenAnchored[_phash], "pHash already anchored");

        hasBeenAnchored[_phash] = true;

        records.push(ImageRecord({
            phash: _phash,
            author: msg.sender,
            timestamp: block.timestamp,
            context: _context
        }));

        emit ImageAnchored(
            records.length - 1,
            _phash,
            msg.sender,
            block.timestamp,
            _context
        );
    }

    /**
     * @notice Returns every anchored record (view, no gas cost).
     */
    function getAllRecords() external view returns (ImageRecord[] memory) {
        return records;
    }

    /**
     * @notice Total number of anchored images.
     */
    function getRecordCount() external view returns (uint256) {
        return records.length;
    }
}
