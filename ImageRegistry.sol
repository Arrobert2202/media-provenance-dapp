// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title  ImageRegistry
 * @notice On-chain registry for image perceptual hashes.
 *         Stores the hash, author address, block timestamp, and a context string.
 */
contract ImageRegistry {

    struct ImageRecord {
        string  phash;
        address author;
        uint256 timestamp;
        string  context;
    }

    mapping(string => ImageRecord) private _records;
    string[] private _allHashes;

    /**
     * @notice Emitted when a new image record is anchored.
     * @param phash     Perceptual hash of the registered image.
     * @param author    Address of the submitting account.
     * @param timestamp Block timestamp at registration time.
     * @param context   Caller-supplied context string.
     */
    event ImageAnchored(
        string  indexed phash,
        address indexed author,
        uint256         timestamp,
        string          context
    );

    error DuplicatePHash(string phash);
    error EmptyString(string paramName);

    /**
     * @notice Anchor an image's perceptual hash on-chain.
     * @param phash   Hex pHash string generated off-chain.
     * @param context Short description of the image.
     */
    function anchorImage(string calldata phash, string calldata context) external {
        if (bytes(phash).length == 0)             revert EmptyString("phash");
        if (bytes(context).length == 0)           revert EmptyString("context");
        if (_records[phash].author != address(0)) revert DuplicatePHash(phash);

        _records[phash] = ImageRecord({
            phash    : phash,
            author   : msg.sender,
            timestamp: block.timestamp,
            context  : context
        });

        _allHashes.push(phash);
        emit ImageAnchored(phash, msg.sender, block.timestamp, context);
    }

    /**
     * @notice Returns true if the given pHash is already registered.
     */
    function isRegistered(string calldata phash) external view returns (bool) {
        return _records[phash].author != address(0);
    }

    /**
     * @notice Retrieve the full record for a registered pHash.
     */
    function getRecord(string calldata phash)
        external
        view
        returns (ImageRecord memory record)
    {
        record = _records[phash];
        require(record.author != address(0), "ImageRegistry: pHash not found");
    }

    /// @notice Returns the total number of registered images.
    function totalAnchored() external view returns (uint256) {
        return _allHashes.length;
    }

    /**
     * @notice Returns the pHash at a given index in registration order.
     */
    function getHashAtIndex(uint256 index) external view returns (string memory) {
        require(index < _allHashes.length, "ImageRegistry: index out of bounds");
        return _allHashes[index];
    }
}
