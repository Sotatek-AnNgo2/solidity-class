pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Swapper is OwnableUpgradeable, ReentrancyGuardUpgradeable {
  using SafeERC20 for IERC20;

  struct Request {
    address fromAddress;
    address toAddress;
    address fromToken;
    address toToken;
    uint fromAmount;
    uint toAmount;
    Status status;
  }
  enum Status {
    CREATED,
    APPROVED,
    REJECTED,
    CANCELLED
  }

  address private treasury;
  uint8 public fee;
  uint private requestCount;
  mapping (uint => Request) private requests;

  event FeeUpdated(uint _fee);
  event TreasuryUpdated(address _treasury);
  event RequestCreated(
    uint _requestId,
    address _fromAddres,
    address _toAddress,
    address _fromToken,
    address _toToken,
    uint _fromAmount,
    uint _toAmount
  );
  event RequestCancelled(uint _requestId);
  event RequestApproved(uint _requestId);
  event RequestRejected(uint _requestId);

  modifier noZeroAddress(address _address) {
    require(_address != address(0), "Zero address no allow");
    _;
  }

  function initialize(address _owner, address _treasury)
    public initializer noZeroAddress(_owner) noZeroAddress(_treasury) {
    treasury = _treasury;
  }

  function setFee(uint8 _fee) external onlyOwner {
    fee = _fee;

    emit FeeUpdated(_fee);
  }

  function updateTreasury(address _treasury) external onlyOwner {
      require(_treasury != address(0), "Treasury address cannot be zero");
      treasury = _treasury;
      emit TreasuryUpdated(_treasury);
  }

  function createRequest(address _toAddress, address _fromToken, address _toToken, uint _fromAmount, uint _toAmount)
    external nonReentrant noZeroAddress(_toAddress) noZeroAddress(_fromToken) noZeroAddress(_toToken) {
    IERC20 fromToken = IERC20(_fromToken);
    fromToken.safeTransferFrom(msg.sender, address(this), _fromAmount);
    requestCount++;
    requests[requestCount] = Request(msg.sender, _toAddress, _fromToken, _toToken, _fromAmount, _toAmount, Status.CREATED);

    emit RequestCreated(requestCount, msg.sender, _toAddress, _fromToken, _toToken, _fromAmount, _toAmount);

  }

  function cancelRequest(uint _requestId) external nonReentrant {
    Request storage request = requests[_requestId];
    require(request.fromAddress == msg.sender && request.status == Status.CREATED, "Cannot cancel this request");

    request.status = Status.CANCELLED;
    IERC20 fromToken = IERC20(request.fromToken);
    fromToken.safeTransferFrom(address(this), request.fromAddress, request.fromAmount);

    emit RequestCancelled(_requestId);
  }

  function approveRequest(uint _requestId) external nonReentrant {
    Request storage request = requests[_requestId];
    require(request.status == Status.CREATED && msg.sender == request.toAddress, "Cannot approve this request");

    IERC20 fromToken = IERC20(request.fromToken);
    IERC20 toToken = IERC20(request.toToken);
    uint8 feePercent = fee;
    address treasuryAddress = treasury;

    uint netFromAmount = request.fromAmount * (100 - feePercent) / 100;
    uint netToAmount = request.toAmount * (100 - feePercent) / 100;

    fromToken.safeTransfer(request.toAddress, netFromAmount);
    fromToken.safeTransfer(treasuryAddress, request.fromAmount - netFromAmount);

    toToken.safeTransferFrom(request.toAddress, request.fromAddress, netToAmount);
    toToken.safeTransferFrom(request.toAddress, treasuryAddress, request.toAmount - netToAmount);

    request.status = Status.APPROVED;

    emit RequestApproved(_requestId);
  }

  function rejectRequest(uint _requestId) external nonReentrant {
    Request storage request = requests[_requestId];
    require(request.toAddress == msg.sender && request.status == Status.CREATED, "Cannot reject this request");

    request.status = Status.REJECTED;
    IERC20 fromToken = IERC20(request.fromToken);
    fromToken.safeTransferFrom(address(this), request.fromAddress, request.fromAmount);

    emit RequestRejected(_requestId);
  }

    receive() external payable {
      revert();
    }

    fallback() external payable {
      revert();
    }
}