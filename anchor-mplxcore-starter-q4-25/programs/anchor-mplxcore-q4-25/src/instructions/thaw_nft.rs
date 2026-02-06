use anchor_lang::prelude::*;
use mpl_core::{
    instructions::UpdatePluginV1CpiBuilder,
    types::{FreezeDelegate, Plugin},
    ID as CORE_PROGRAM_ID,
};

use crate::{error::MPLXCoreError, state::CollectionAuthority};

#[derive(Accounts)]
pub struct ThawNft<'info> {
    // TODO
    #[account(mut,
        constraint = authority.key() == collection_authority.creator @ MPLXCoreError::NotAuthorized
    )]
    pub authority: Signer<'info>,
    #[account(
        mut, constraint = !asset.data_is_empty() @
        MPLXCoreError::AssetNotInitialized
    )]
    /// CHECK: The asset to thaw.
    pub asset: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = !asset.data_is_empty() @ MPLXCoreError::AssetNotInitialized,
        constraint = !collection.data_is_empty() @ MPLXCoreError::CollectionNotInitialized
    )]
    /// CHECK: The asset to thaw
    pub collection: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"collection_authority", collection.key().as_ref()],
        bump = collection_authority.bump
    )]
    pub collection_authority: Account<'info, CollectionAuthority>,
    #[account(address = CORE_PROGRAM_ID)]
    /// CHECK: This will also be checked by core
    pub core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> ThawNft<'info> {
    pub fn thaw_nft(&mut self) -> Result<()> {
        // TODO

        let signer_seeds: &[&[&[u8]]] = &[&[
            b"collection_authority",
            &self.collection.key().to_bytes(),
            &[self.collection_authority.bump],
        ]];

        UpdatePluginV1CpiBuilder::new(&self.core_program.to_account_info())
            .collection(Some(&self.collection.to_account_info()))
            .asset(&self.asset.to_account_info())
            .authority(Some(&self.collection_authority.to_account_info()))
            .payer(&self.authority.to_account_info())
            .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: false }))
            .system_program(&self.system_program.to_account_info())
            .invoke_signed(signer_seeds)?;

        Ok(())
    }
}
