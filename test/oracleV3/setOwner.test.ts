import { expect } from 'chai'
import { setupFixtureLoader } from '../shared/setup'
import { oracleV3Fixture } from '../shared/fixtures'
import { overrides } from '../shared/utilities'
import { constants } from 'ethers'

describe('TwapOracleV3.setOwner', () => {
  const loadFixture = setupFixtureLoader()

  it('is set to the deployer', async () => {
    const { oracle, wallet } = await loadFixture(oracleV3Fixture)
    expect(await oracle.owner()).to.eq(wallet.address)
  })

  it('can be changed', async () => {
    const { oracle, other } = await loadFixture(oracleV3Fixture)
    await expect(oracle.connect(other).setOwner(other.address, overrides)).to.be.revertedWith('TO00')

    await expect(oracle.setOwner(other.address, overrides)).to.emit(oracle, 'OwnerSet').withArgs(other.address)
    expect(await oracle.owner()).to.eq(other.address)
  })

  it('performs address checks when setting owner', async () => {
    const { oracle, wallet } = await loadFixture(oracleV3Fixture)
    await expect(oracle.setOwner(wallet.address, overrides)).to.be.revertedWith('TO01')
    await expect(oracle.setOwner(constants.AddressZero, overrides)).to.be.revertedWith('TO02')
  })
})
