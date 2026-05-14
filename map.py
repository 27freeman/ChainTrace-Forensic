from pyspark.sql import SparkSession
from pyspark.sql.functions import col,lit


# List of Attackers Adrresses
attacker_address = [
        '0x5d3919F12bCc35c26Eee5F8226A9bee90c257Ccc',
        '0xBb6A6006Eb71205e977eCeb19FCaD1C8d631C787',
        '0x1F4C1c2e610f089D6914c4448E6F21Cb0db3adeF',
        '0xeBA786C9517a4823A5cFD9c72e4E80BF8168129B',
        '0xCBb24A6B4DAfaAA1a759A2F413eA0eB6AE1455CC',
        '0x8d11AeAC74267DD5C56D371bf4AE1AFA174C2d49',
        '0xEb688102533cE9a6dFD7dF62Ebeb2544c8E7cA19',
        '0x18102f56E7Af4228344cA81d67714E14835E87c0',
        '0xE4445DD9A3DBb4D35AeEA21FB244c40Af5EAe78c',
        '0xef3e1064FBfaA4bA5C74fd266Ad03B42adD84020',
        '0x44918718420E17F8Cb2161Cef8a6FAF7309B4e51',
        '0x60C2CdDB1Ac686c5F7e681C898062131af0d3458',
        '0x5d3919F12bCc35c26Eee5F8226A9bee90c257Ccc',
        '0x880A1d8143F552c05642190f12CDd476019a0332',
        '0x10Fc5cF1b74e80B1F14B993E2b6fd11CeF52EAbe',
        '0x77BFE04306CF4901B5019dD3979d6b91652ac433',
        '0x85f36fE7FecFfEB90DAD4F0Dc9820EE374C5b42B',
        '0xFE9464AC9e0dF5C9d494A91dDF8d4347168Af708',
        '0x6A3E2E229B473b1181a897E4D72650DA2D381b18',
        '0x0f9cC1ffa39dbF9B76E66208aD348c5BAf7Ac205',
        '0x73D955FE32c47898906b24467322F2bF3E96CeF1',
        '0xE103C117B962b1e4644B5c461cba9F00EA009E68',
        '0x86E4daf3A48A7c9363C9E8DB131E3cF6a2aFC695',
        '0x8B1b6c9A6DB1304000412dd21Ae6A70a82d60D3b',
        '0x1d35804d55f47B6CD57Ab5eF2D52C9b48dFe64f8',
        '0x89CD76F829f5aC0d365DD3271A41e66E5ce07EB6',
        '0x4A8Fb59994E76CB38B2b9FA99572255AF9479C35',
        '0x2ec78D963c25058C7238B35A75D789371B09A95E',
        '0xdc0b7A8d203432242Cf768B25ae2E6E6870B142e',
        '0x5faFF66de2189fdB3988391d58235b1A869892E2',
        '0xC45be661388e339717Dd1e1A7E8401e294b1f00D',
        '0xA50C48AA7581452eE83E6232aF13fDE73cDCd9A2',
        '0xfe7E8D3a2d883C4739DF70Df29379EFAcf08b294',
        '0xa57D324d4d7E94f1D64A7ebEf4B3e7F5c8c1703d',
        '0x40B32176579D8BA2974Af5F4871BFE39b0bf4A5D',
        '0x9e3EF015c35e92bFEed4e1cDAa155D0c197546f2',
        '0x60167ACDe3B5F56bD0b42A700B027048039F886c',
        '0x32734cb0754406A66917Bd92AC54D763C4033dC5',
        '0xfb882Eda2863af7C5D6110E07Dc6a5571d2F4dB6',
        '0xe28DF1205f4326C38B5E3c71ec1e670B2BA23a0E',
        '0x0eAaec4e8299409faaA93e81eF5Ed49d1CA90b69',
        '0x8d11AeAC74267DD5C56D371bf4AE1AFA174C2d49',
        '0x62c72510016732333e68177d388a8111643FC64E',
        '0x008036BAf1caa1037fbDbBf89aB10Aa86f6AF23F',
        '0xB4A6E69F7dc3866914B568F3dE4f3D8B47D80Ca5',
        '0x168063C873722cA740baE9386fDbf34f87967B07',
        '0xf9092320F85D3bE63A87d77Ab5d1807848756236',
        '0x813EC3D3b60A74E126913919eb03859595838BF4',
        '0x92645E2C8E31421ECf7Bc2e107C31b4383A095D1',
        '0x26fFB998295B5bd7253c84F8A0C0F978c694E0a2',
        '0x3C33aCCC9ea4dDD690A3ca5Ddd903fE87cDe7fAb',
        '0x5677Ce452e1447D3fcE3ecbabdF5314937482076',
        '0xE9E2F48Bb0018276391AEc240AbB46e8C3caD181',
        '0x46782631dF7c04Af3ebf7e3FbB7Aa70fC9B754e9',
        '0xA35Dac930501AA34e2F110c12c19df6F1446053B',
        '0x326C89D28ceb57479f81913BCBe60FD05f919E06',
        '0xd57aB8e692Dc6DFe19d98DD9B9c331F26742265b',
        '0x496b287043e9a7146D9F39014c0D6eBfB21DFaBE',
        '0x7FE807A57E6C875C897A2Cb841233425E250B991',
        '0xa3B8b3b154A25be0eC76958b3439f79483F06DBA',
        '0xc00f04A33Ca521ca167903b5ae59810013eCb7AF',
        '0x204a5492F60b771E8622a813BfE1ee3E90a53d6D',
        '0x83c206CCa7F40fcb916Cda8458383dF42aC773E4',
        '0x261A1FDF0E4142eec9c4d332eb3073b1dFcDDD8A',
        '0xD4B87bAB0ee142182f7F6DA030AeFe3E7f171530',
        '0x532037c76362539281B352042E5C0d943268a017',
        '0xa4097aa438DCf6c74F6DBa273112582e47971455',
        '0x825322B82c3419f9a0C7219593B0180D9828512F',
        '0x798eE741b343fB923FD3f57D6fE36bebEa891bD9',
        '0x42a71A7ED12582378d4A4567A1af6Bad4f03dF84',
        '0xDdCA1560b99DC2f3d2d106ccc9677415CE60D203',
        '0x59ef362A6511ea15Af2DbB72E0a79671F1094EcC',
        '0xAF35C2F88637326d9dE33d69b91d090090456c10',
        '0xAa57A7e7eF49001a30357eF89BD09Eb296f5B5Cd',
        '0x5D09ae5f679E1b0710Cfa5e473694a635d062907',
        '0x2A016E7B0E53Bece1E4a76282f3CFb5eC876a796',
        '0x1dF204F335E9D2778782548CF10fd19EF03B5bCa',
        '0x4113817E3575a82611AaD1f00C3f42fce0180851',
        '0xF9802c5EB6b972Ba686aFa7CA615910Ea8310b85',
        '0xC91F8d6200Fc427D5993f58b428882FFAD8FA7D9',
        '0xf4d269b0dc84a41e6CFD7EFeedA1b9Bb372F7F1D',
        '0x588782c2dc95a279C76E17e332FD13d2D217e874',
        '0xCBb24A6B4DAfaAA1a759A2F413eA0eB6AE1455CC',
        '0xbE430DfD98eB33880f87D5618Fc037c04521ddD8',
        '0xBc1C8c3Ee6bEF31F9f0c2Da801Ac48A1363399Cc',
        '0x6903B41F194c9503E0Bc76f8b4c13143Fe99Ef7B',
        '0xba1DB0A0c17B6E9e2E65cA2dDB9fEE344c553D41',
        '0x91E3fFb2AEF93F5EA1997E142A383F5976B91304',
        '0x1e4Fd70645C0E7349701f6f73bE4DAF0d2cE6388',
        '0xFD0418D3D663f21b503Ca3Ee6ad72C1e760926EC',
        '0x170c28afc8b052Ce66b85165af97C8FA17CADC86',
        '0xd592f25C3D884292199036b960aB1D811d539581',
        '0xA42430BE7176f1e04bECaa290592035f1B095C40',
        '0xeBA786C9517a4823A5cFD9c72e4E80BF8168129B',
        '0xBb10DBA6Fc24fe2F2b0ed05c548A4271d1274046',
        '0x6cD95e71C0e5faD6506b7c588A5af0251AEe1E3a',
        '0x1c1a82627DA9A8a09C8DF8078b2A57008BE19097',
        '0x1F4C1c2e610f089D6914c4448E6F21Cb0db3adeF',
        '0x37fCDd9D74A5F96d61B48d1FB640e80f52FfD49a',
        '0x948959E90d6cF6824477dc83aEF80e843b7406Fb',
        '0xFe76a3325E80e56bCF16E25c89c471409D9976bB',
        '0x19524C343f382fD999BebD93DB6e76B41b38497c',
        '0x8b741a0Aa31a9e2C39bbCD09e68C39F2aa82889d',
        '0x5D9f44DF6557d9b0BCbF1BDc1184b3C1BF4f409B',
        '0x64cabeEeE8A2E7B01A29B31dcF4548a8A28115D8',
        '0xBb6A6006Eb71205e977eCeb19FCaD1C8d631C787',
        '0xABc82C8975c922E5aa836b4AFd36FAD4511A65b8',
        '0x724Fb48258A11b51313CB8088dE5E2D4963833f3',
        '0x9A5BF60ace778228CD9716aABA01090dD9048C6E',
        '0x8A9807B1f403b1b5Df167cC653124Bb6E378BCdC',
        '0x89b61DFee486534Eec4A307dc3DF68c6D3AfEeC4',
        '0x589674B9124b84cB311779512ec1698f7122e456',
        '0x9a46A4e059DAC82cdC7f419c7dBF9EbDB49282a4',
        '0x266B12AA633092B664073Ecee1b1269aF370b273',
        '0xb5f874EAE8dbf82E2306DEA4338574bf8d04e15c',
        '0x40BFf9293339D0893Daf8670802184f11D478653',
        '0x1B748B680373a1dd70A2319261328cAb2a6F644c',
        '0x0A6272bEd21375429d9176B60736BB8ED2b6cD62',
        '0xe4A083EeC7081563A548934Ff8473Dbb36Ef2885',
        '0x33F6C752E69d04F2ab162d9Cc2Ff8D1766326F18',
        '0xB8e2A7B90AD5f1049a995Be72210b09cb4e35373',
        '0xF8F202776eB1A671933Cd0eBf09d68C17D26d546',
        '0x2BD87c05617a68bEab3Ee8C89b2C0929d98B13C8',
        '0x3e4Ed9ee5130c49D1e9eA32B9D9947054fBB21F1',
        '0x1c2CFD70F5962203ca746B61408217352F7616BA'
    ]

attacker_address = [add.lower() for add in attacker_address]

spark = SparkSession.builder\
    .master('local[*]')\
    .appName('evil')\
    .getOrCreate()

# Loading attackers Transfers
transfer_df = spark.read\
        .option('header','true')\
        .parquet('attackers_transfers')

transaction_df = spark.read\
        .option('header','true')\
        .parquet('attackers_transactions')

attackers_Eth_trf = transfer_df.filter(
    col("from_address").isin(attacker_address) &
    col("to_address").isin(attacker_address)
)


attackers_Eth_trf = attackers_Eth_trf \
                    .withColumn('label', lit('mutual_transfer')) \
                    .select('tx_hash', 'block_time', 'from_address', 'to_address', 'amount', 'amount_usd','label')


# Thorchain Contract
thorchain_contract = [
    '0x9Fc30541611132C5AC38318E8eEE044d2d36996F',
    '0x4fEeA1caEEA66B3351ddBa68BD80c37c9eD6C3c8',
    '0x57BB04F3215dbbb60b9DA6154e0a7ABDb6FbAc27',
    '0xd37bbe5744d730a1d98d8dc97c42f0ca46ad7146'
]
thorchain_contract = [ add.lower() for add in thorchain_contract]

thorchain_launder = transaction_df.filter(
        col("to").isin(thorchain_contract)
    )
thorchain_launder = thorchain_launder\
                        .withColumn('label',lit('thorchain_launder'))
                        

thorchain_launder = transfer_df.join(thorchain_launder, 
                     on=(transfer_df['tx_hash'] == thorchain_launder['hash']) &
                        (transfer_df['from_address'] == thorchain_launder['from']) &
                        (transfer_df['to_address'] == thorchain_launder['to']),
                     how="inner") \
                    .drop(thorchain_launder['block_time'])

thorchain_launder = thorchain_launder.select('tx_hash','block_time','from_address','to_address','amount','amount_usd','label')

attackers_action = attackers_Eth_trf.union(thorchain_launder)

attackers_action.write.mode('overwrite').parquet('attackers_action')
print("attackers_action saved")

attackers_action.show(5)