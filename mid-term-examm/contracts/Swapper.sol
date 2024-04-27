pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Swapper is Ownable {
  struct Request {
    address fromAddress;
    address toAddress;
    address fromToken;
    address toToken;
    Status status;
    uint amount;
  }
  enum Status {
    CREATED,
    APPROVED,
    REJECTED,
    CANCELLED
  }

  address private treasury;
  uint private requestCount;
  uint private decimals;
  mapping (uint => Request) private requests;
  mapping (uint => uint) private exchangeRates;
  mapping (uint => uint) private exchangeFees;

  event ExchangeRateAndFee(address _fromAddres, address _toAddress, uint _exchangeRate, uint _exchangeFee);
  event RequestCreated(uint _requestId, address _fromAddres, address _toAddress, address _fromToken, address _toToken, uint amount);
  event RequestCancelled(uint _requestId);
  event RequestApproved(uint _requestId);
  event RequestRejected(uint _requestId);

  constructor(address _owner, address _treasury) Ownable(_owner) {
    require(_owner != address(0) && _treasury != address(0), "Params wrong");
    decimals = 8;
    treasury = _treasury;
  }

  function getTokenHash(address _fromToken, address _toToken) internal pure returns (uint tokenHash) {
    tokenHash = uint(keccak256(abi.encodePacked(_fromToken, _toToken)));
  }

  function getExchangeRate(address _fromToken, address _toToken) public view returns (uint exchangeRate) {
    uint tokenHash = getTokenHash(_fromToken, _toToken);
    exchangeRate = exchangeRates[tokenHash];
  }

  function calculateTransferAmount(address _fromToken, address _toToken, uint amount) internal view returns (uint fromReceive, uint toReceive) {
    ERC20 fromToken = ERC20(_fromToken);
    ERC20 toToken = ERC20(_toToken);

    uint fromDecimal = fromToken.decimals();
    uint toDecimal = toToken.decimals();
    uint exchangeRate = getExchangeRate(_fromToken, _toToken);

    fromReceive = amount * exchangeRate / 10 ** (decimals + toDecimal - fromDecimal);
    toReceive = amount;
  }

  function getExchangeFee(address _fromToken, address _toToken) public view returns (uint exchangeFee) {
    uint tokenHash = getTokenHash(_fromToken, _toToken);
    exchangeFee = exchangeFees[tokenHash];
  }

  function setExchangeRateAndFee(address _fromToken, address _toToken, uint _exchangeRate, uint _exchangeFee) external onlyOwner {
    require(_exchangeRate != 0, "");
    uint tokenHash = getTokenHash(_fromToken, _toToken);

    exchangeRates[tokenHash] = _exchangeRate;
    exchangeFees[tokenHash] = _exchangeFee;

    emit ExchangeRateAndFee(_fromToken, _toToken, _exchangeRate, _exchangeFee);
  }

  function createRequest(address _toAddress, address _fromToken, address _toToken, uint _amount) external {
    require(getExchangeRate(_fromToken, _toToken) != 0, "Token not support");

    ERC20 fromToken = ERC20(_fromToken);
    fromToken.transferFrom(msg.sender, address(this), _amount);
    requests[requestCount] = Request(msg.sender, _toAddress, _fromToken, _toToken, Status.CREATED, _amount);

    emit RequestCreated(requestCount++, msg.sender, _toAddress, _fromToken, _toToken, _amount);
  }

  function cancelRequest(uint _requestId) external {
    Request storage request = requests[_requestId];
    require(request.fromAddress == msg.sender && request.status == Status.CREATED, "Must be creator");

    request.status = Status.CANCELLED;

    emit RequestCancelled(_requestId);
  }

  function approveRequest(uint _requestId) external {
    Request storage request = requests[_requestId];
    require(request.status == Status.CREATED && msg.sender == request.toAddress, "Cannot approve");

    ERC20 fromToken = ERC20(request.fromToken);
    ERC20 toToken = ERC20(request.toToken);
    uint exchangeFee = getExchangeFee(request.fromToken, request.toToken);
    (uint fromReceive, uint toReceive) = calculateTransferAmount(request.fromToken, request.toToken, request.amount);
    uint fee = fromReceive * exchangeFee / 10 ** (decimals + 2);

    fromToken.transferFrom(address(this), request.toAddress, toReceive);
    toToken.transferFrom(request.toAddress, address(this), fee);
    toToken.transferFrom(request.toAddress, request.fromAddress, fromReceive - fee);
    request.status = Status.APPROVED;

    emit RequestApproved(_requestId);
  }

  function rejectRequest(uint _requestId) external {
    Request storage request = requests[_requestId];
    require(request.toAddress == msg.sender && request.status == Status.CREATED, "Must be creator");

    request.status = Status.REJECTED;

    emit RequestRejected(_requestId);
  }

}