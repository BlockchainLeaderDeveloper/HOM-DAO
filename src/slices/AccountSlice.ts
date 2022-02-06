import { ethers } from "ethers";
import { addresses } from "../constants";
import { abi as ierc20Abi } from "../abi/IERC20.json";
import { abi as sBHD } from "../abi/sBHD.json";
import { abi as pBHD } from "../abi/pBHD.json";
import { abi as presaleAbi} from "../abi/Presale.json"
import { setAll } from "../helpers";

import { createAsyncThunk, createSelector, createSlice } from "@reduxjs/toolkit";
import { Bond, NetworkID } from "src/lib/Bond"; // TODO: this type definition needs to move out of BOND.
import { RootState } from "src/store";
import { IBaseAddressAsyncThunk, ICalcUserBondDetailsAsyncThunk } from "./interfaces";

export const getBalances = createAsyncThunk(
  "account/getBalances",
  async ({ address, networkID, provider }: IBaseAddressAsyncThunk) => {
    console.log('debug->dashboard1')
    const HOMContract = new ethers.Contract(addresses[networkID].HOM_ADDRESS as string, ierc20Abi, provider);
    const HOMBalance = await HOMContract.balanceOf(address);
    const sHOMContract = new ethers.Contract(addresses[networkID].SHOM_ADDRESS as string, sBHD, provider);
    const sHOMBalance = await sHOMContract.balanceOf(address);
   // let poolBalance = 0;
    //const poolTokenContract = new ethers.Contract(addresses[networkID].PT_TOKEN_ADDRESS as string, ierc20Abi, provider);
    //poolBalance = await poolTokenContract.balanceOf(address);


    return {
      balances: {
        HOM: ethers.utils.formatUnits(HOMBalance, "gwei"),
        sHOM: ethers.utils.formatUnits(sHOMBalance, "gwei"),
        // pool: ethers.utils.formatUnits(poolBalance, "gwei"),
      },
    };
  },
);

export const loadAccountDetails = createAsyncThunk(
  "account/loadAccountDetails",
  async ({ networkID, provider, address }: IBaseAddressAsyncThunk) => {
    let HOMBalance = 0;
    let sHOMBalance = 0;
    let pHOMBalance = 0;
    let mimBalance = 0;
    let presaleAllowance = 0;
    let claimAllowance = 0;
    let stakeAllowance = 0;
    let unstakeAllowance = 0;
    let daiBondAllowance = 0;
  //  let poolAllowance = 0;
    let multiSignBalance = 0;
    
    const daiContract = new ethers.Contract(addresses[networkID].DAI_ADDRESS as string, ierc20Abi, provider);
    const daiBalance = await daiContract.balanceOf(address);
    
    const mimContract = new ethers.Contract(addresses[networkID].DAI_ADDRESS as string, ierc20Abi, provider);
    mimBalance = await mimContract.balanceOf(address);

    multiSignBalance = await daiContract.balanceOf(addresses[networkID].MULTISIGN_ADDRESS) / Math.pow(10, 18);
    console.log('debug multiSignBalance account', daiBalance);
    const pHOMContract = new ethers.Contract(addresses[networkID].PHOM_ADDRESS as string, pBHD, provider);
    pHOMBalance = await pHOMContract.balanceOf(address);
   


    const HOMContract = new ethers.Contract(addresses[networkID].HOM_ADDRESS as string, ierc20Abi, provider);

    HOMBalance = await HOMContract.balanceOf(address);
    stakeAllowance = await HOMContract.allowance(address, addresses[networkID].STAKING_HELPER_ADDRESS);

    const sHOMContract = new ethers.Contract(addresses[networkID].SHOM_ADDRESS as string, sBHD, provider);

    sHOMBalance = await sHOMContract.balanceOf(address);
    unstakeAllowance = await sHOMContract.allowance(address, addresses[networkID].STAKING_ADDRESS);
 
   // poolAllowance = await sHOMContract.allowance(address, addresses[networkID].PT_PRIZE_POOL_ADDRESS);
    console.log('pHOMBALANCE',sHOMContract)
    if (addresses[networkID].DAI_ADDRESS) {
      presaleAllowance = await daiContract.allowance(address, addresses[networkID].PRESALE_ADDRESS);
    }

    if (addresses[networkID].PHOM_ADDRESS) {
      claimAllowance = await pHOMContract.allowance(address, addresses[networkID].PRESALE_ADDRESS);
    }

    console.log('debug->dashboard2')
    
    const presaleContract = new ethers.Contract(addresses[networkID].PRESALE_ADDRESS as string, presaleAbi, provider);
    const HOMPrice = await presaleContract.getPriceForThisAddress(address);
    const remainingAmount = await presaleContract.getUserRemainingAllocation(address);
    const isStarted = await presaleContract.started();
    const isEnded = await presaleContract.ended();
    const minCap = await presaleContract.minCap();
    const cap = await presaleContract.cap();
    let presaleStatus = "Presale has not yet started.";
    if(isStarted){
      presaleStatus = "Presales is Active!";
    } 
    if(isEnded)
      presaleStatus = "Presales was ended";
    
    

    return {
      balances: {
        dai: ethers.utils.formatEther(daiBalance),
        busd: ethers.utils.formatEther(daiBalance),
        HOM: ethers.utils.formatUnits(HOMBalance, "gwei"),
        sHOM: ethers.utils.formatUnits(sHOMBalance, "gwei"),
        pHOM: ethers.utils.formatUnits(pHOMBalance, "gwei"),
        
      },

      presale: {
        presaleAllowance: +presaleAllowance,
        tokenPrice: ethers.utils.formatEther(HOMPrice),
        remainingAmount: ethers.utils.formatEther(remainingAmount),
        presaleStatus: presaleStatus,
        minCap: ethers.utils.formatEther(minCap),
        cap: ethers.utils.formatEther(cap),
        multiSignBalance: multiSignBalance,
      },
      claim: {
        claimAllowance: +claimAllowance,
      },
      staking: {
        HOMStake: +stakeAllowance,
        HOMUnstake: +unstakeAllowance,
      },
      bonding: {
        daiAllowance: daiBondAllowance,
      },
      pooling: {
        // sHOMPool: +poolAllowance,
      },
    };
  },
);

export interface IUserBondDetails {
  allowance: number;
  interestDue: number;
  bondMaturationTime: number;
  pendingPayout: string; //Payout formatted in gwei.
}
export const calculateUserBondDetails = createAsyncThunk(
  "account/calculateUserBondDetails",
  async ({ address, bond, networkID, provider }: ICalcUserBondDetailsAsyncThunk) => {
    if (!address) {
      return {
        bond: "",
        displayName: "",
        bondIconSvg: "",
        isLP: false,
        allowance: 0,
        balance: "0",
        interestDue: 0,
        bondMaturationTime: 0,
        pendingPayout: "",
      };
    }
    // dispatch(fetchBondInProgress());

    // Calculate bond details.
    const bondContract = bond.getContractForBond(networkID, provider);
    const reserveContract = bond.getContractForReserve(networkID, provider);

    const daiContract = new ethers.Contract(addresses[networkID].DAI_ADDRESS as string, ierc20Abi, provider);
   
    let multiSignBalance = await daiContract.balanceOf(addresses[networkID].MULTISIGN_ADDRESS);
   
    console.log('debug->dashboard3')
    let interestDue, pendingPayout, bondMaturationTime;

    const bondDetails = await bondContract.bondInfo(address);
    interestDue = bondDetails.payout / Math.pow(10, 9);
    bondMaturationTime = +bondDetails.vesting + +bondDetails.lastTime;
    pendingPayout = await bondContract.pendingPayoutFor(address);

    let allowance,
      balance = 0;
    allowance = await reserveContract.allowance(address, bond.getAddressForBond(networkID));
    balance = await reserveContract.balanceOf(address);
    // formatEthers takes BigNumber => String
    // let balanceVal = ethers.utils.formatEther(balance);
    // balanceVal should NOT be converted to a number. it loses decimal precision
    let deciamls = 18;
    if (bond.name == "usdc") {
      deciamls = 6;
    }
    const balanceVal = balance / Math.pow(10, deciamls);
    return {
      bond: bond.name,
      displayName: bond.displayName,
      bondIconSvg: bond.bondIconSvg,
      isLP: bond.isLP,
      allowance: Number(allowance),
      balance: balanceVal.toString(),
      interestDue,
      bondMaturationTime,
      pendingPayout: ethers.utils.formatUnits(pendingPayout, "gwei"),
    };
  },
);

interface IAccountSlice {
  bonds: { [key: string]: IUserBondDetails };
  balances: {
    bhd: string;
    sbhd: string;
    pbhd: string;
    dai: string;
    busd: string;
  };
  loading: boolean;
}
const initialState: IAccountSlice = {
  loading: false,
  bonds: {},
  balances: { bhd: "", sbhd: "", pbhd: "", dai: "", busd: "" },
};

const accountSlice = createSlice({
  name: "account",
  initialState,
  reducers: {
    fetchAccountSuccess(state, action) {
      setAll(state, action.payload);
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadAccountDetails.pending, state => {
        state.loading = true;
      })
      .addCase(loadAccountDetails.fulfilled, (state, action) => {
        setAll(state, action.payload);
        state.loading = false;
      })
      .addCase(loadAccountDetails.rejected, (state, { error }) => {
        state.loading = false;
        console.log(error);
      })
      .addCase(getBalances.pending, state => {
        state.loading = true;
      })
      .addCase(getBalances.fulfilled, (state, action) => {
        setAll(state, action.payload);
        state.loading = false;
      })
      .addCase(getBalances.rejected, (state, { error }) => {
        state.loading = false;
        console.log(error);
      })
      .addCase(calculateUserBondDetails.pending, state => {
        state.loading = true;
      })
      .addCase(calculateUserBondDetails.fulfilled, (state, action) => {
        if (!action.payload) return;
        const bond = action.payload.bond;
        state.bonds[bond] = action.payload;
        state.loading = false;
      })
      .addCase(calculateUserBondDetails.rejected, (state, { error }) => {
        state.loading = false;
        console.log(error);
      });
  },
});

export default accountSlice.reducer;

export const { fetchAccountSuccess } = accountSlice.actions;

const baseInfo = (state: RootState) => state.account;

export const getAccountState = createSelector(baseInfo, account => account);
