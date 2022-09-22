import { expect } from 'chai'
import { constants, BigNumber, utils } from 'ethers'
import { delayOracleV3Fixture } from '../../shared/fixtures'
import { getDefaultBuy } from '../../shared/orders'
import { OrderType } from '../../shared/OrderType'
import { setupFixtureLoader } from '../../shared/setup'
import { overrides, pairAddressToPairId } from '../../shared/utilities'

describe('TwapDelay.buy.oracleV3', () => {
  const loadFixture = setupFixtureLoader()

  it('refunds excess value', async () => {
    const { delay, token, weth, wallet } = await loadFixture(delayOracleV3Fixture)

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice)

    await token.approve(delay.address, constants.MaxUint256, overrides)

    const balanceBefore = await wallet.getBalance()

    const buyRequest = getDefaultBuy(weth, token, wallet)
    const wethAmount = 1000
    const excess = 1234
    buyRequest.amountInMax = BigNumber.from(wethAmount)
    const value = gasPrice.mul(buyRequest.gasLimit).add(wethAmount)
    buyRequest.wrapUnwrap = true

    const tx = await delay.buy(buyRequest, {
      ...overrides,
      value: value.add(excess),
    })

    const { gasUsed, effectiveGasPrice } = await tx.wait()

    const balanceAfter = await wallet.getBalance()
    expect(balanceBefore.sub(balanceAfter).sub(gasUsed.mul(effectiveGasPrice))).to.equal(value)
    expect(await wallet.provider.getBalance(delay.address)).to.eq(value.sub(wethAmount))
  })

  it('enqueues an order', async () => {
    const { delay, token0, token1, wallet, pair } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await delay.gasPrice()
    const buyRequest = getDefaultBuy(token0, token1, wallet)

    await token0.approve(delay.address, constants.MaxUint256, overrides)
    const tx = await delay.buy(buyRequest, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit),
    })

    const { timestamp } = await wallet.provider.getBlock((await tx.wait()).blockHash)
    const newestOrderId = await delay.newestOrderId()
    const { orderType, validAfterTimestamp } = await delay.getOrder(newestOrderId)
    const result = await delay.getBuyOrder(newestOrderId)

    expect(orderType).to.equal(OrderType.Buy)
    expect(validAfterTimestamp).to.equal((await delay.delay()) + timestamp)
    expect([...result]).to.deep.eq([
      pairAddressToPairId(pair.address),
      false,
      buyRequest.amountInMax,
      buyRequest.amountOut,
      buyRequest.wrapUnwrap,
      buyRequest.to,
      gasPrice,
      BigNumber.from(buyRequest.gasLimit),
      result.validAfterTimestamp,
      result.priceAccumulator,
      result.timestamp,
    ])
  })

  it('enqueues an inverted order', async () => {
    const { delay, token0, token1, wallet, pair } = await loadFixture(delayOracleV3Fixture)
    await delay.setGasPrice(0)
    const buyRequest = getDefaultBuy(token1, token0, wallet)

    await token1.approve(delay.address, constants.MaxUint256, overrides)
    await delay.buy(buyRequest, overrides)

    const result = await delay.getBuyOrder(await delay.newestOrderId())
    expect([...result]).to.deep.equal([
      pairAddressToPairId(pair.address),
      true,
      buyRequest.amountInMax,
      buyRequest.amountOut,
      buyRequest.wrapUnwrap,
      buyRequest.to,
      BigNumber.from(0),
      BigNumber.from(buyRequest.gasLimit),
      result.validAfterTimestamp,
      result.priceAccumulator,
      result.timestamp,
    ])
  })

  it('returns orderId', async () => {
    const { delay, orderIdTest, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await delay.gasPrice()
    const buyRequest = getDefaultBuy(token0, token1, wallet)

    await token0.transfer(orderIdTest.address, utils.parseEther('10'), overrides)
    await orderIdTest.approve(token0.address, delay.address, constants.MaxUint256, overrides)

    await expect(
      orderIdTest.buy(buyRequest, {
        ...overrides,
        value: gasPrice.mul(buyRequest.gasLimit),
      })
    )
      .to.emit(orderIdTest, 'OrderId')
      .withArgs(1)
  })
})
