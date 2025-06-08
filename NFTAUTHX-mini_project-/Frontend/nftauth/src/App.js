import React, { useState } from "react";

function App() {
    const [account, setAccount] = useState("");
    const [file, setFile] = useState(null);
    const [nftName, setNftName] = useState("");
    const [action, setAction] = useState("register");
    const [verificationResult, setVerificationResult] = useState(null);
    const [registrationResult, setRegistrationResult] = useState(null);

    const connectWallet = async () => {
        if (window.ethereum) {
            try {
                const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
                setAccount(accounts[0]);
            } catch (error) {
                console.error("MetaMask Connection Error:", error);
                alert("Failed to connect MetaMask!");
            }
        } else {
            alert("MetaMask not detected. Please install it.");
        }
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!account) return alert("Please connect MetaMask first!");
        if (!file || !nftName) return alert("Please upload an image and enter NFT name!");

        console.log("=== STARTING FORM SUBMISSION ===");
        
        const formData = new FormData();
        formData.append("image", file);
        formData.append("name", nftName);
        formData.append("address", account);
        
        // Add additional fields for both registration and verification
        const contractAddress = e.target.elements.contractAddress?.value;
        const tokenId = e.target.elements.tokenId?.value;
        const ownerAddress = e.target.elements.ownerAddress?.value || account;
        
        console.log("Form data being prepared:", {
            name: nftName,
            address: account,
            contractAddress,
            tokenId,
            ownerAddress,
            fileSize: file.size,
            fileName: file.name
        });
        
        if (contractAddress) formData.append("contractAddress", contractAddress);
        if (tokenId) formData.append("tokenId", tokenId);
        if (ownerAddress) formData.append("ownerAddress", ownerAddress);
        
        // For registration, add a warning if contract address or token ID is missing
        if (action === "register" && (!contractAddress || !tokenId)) {
            const proceed = window.confirm(
                "Without contract address and token ID, source image verification cannot be performed. " +
                "This may reduce the security of your NFT registration. Do you want to continue?"
            );
            if (!proceed) return;
        }

        try {
            // Fix: Remove the leading slash to avoid double slash in URL
            const endpoint = action === "register" ? "register" : "verify";
            
            // Detailed logging for debugging
            console.log("Form submission details:", {
                url: `http://localhost:3001/${endpoint}`,
                method: 'POST',
                action: action,
                nftName: nftName,
                address: account,
                hasFile: !!file,
                fileName: file ? file.name : 'no file'  
            });
            
            console.log("Sending fetch request...");
            const response = await fetch(`http://localhost:3001/${endpoint}`, {
                method: 'POST',
                body: formData,
            });
            console.log("Fetch response received:", {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                headers: [...response.headers.entries()].reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {})
            });

            if (!response.ok) {
                console.error("Response not OK:", response.status, response.statusText);
                const error = await response.json().catch((e) => {
                    console.error("Error parsing error response:", e);
                    return {};
                });
                throw new Error(error.error || `HTTP error! status: ${response.status}`);
            }

            console.log("Parsing response JSON...");
            let data;
            try {
                data = await response.json();
                console.log(`${action.toUpperCase()} Response Data:`, data);
            } catch (e) {
                console.error("Error parsing response JSON:", e);
                throw new Error("Failed to parse response JSON");
            }
            
            // Validate the response data
            if (!data) {
                console.error("Response data is null or undefined");
                throw new Error("Empty response received");
            }
            
            console.log("About to update state with response data");
            try {
                if (action === 'register') {
                    console.log('Setting registration result:', data);
                    setRegistrationResult(data);
                    setVerificationResult(null);
                } else {
                    console.log('Setting verification result:', data);
                    // Force a re-render by creating a new object
                    const newVerificationResult = {...data};
                    console.log('New verification result object:', newVerificationResult);
                    setVerificationResult(newVerificationResult);
                    setRegistrationResult(null);
                }
                console.log("State update complete");
                
                // Double-check state update after a short delay
                setTimeout(() => {
                    if (action === 'register') {
                        console.log('Registration result after update:', registrationResult);
                    } else {
                        console.log('Verification result after update:', verificationResult);
                    }
                }, 100);
            } catch (stateError) {
                console.error("Error updating state:", stateError);
                throw new Error(`Failed to update state: ${stateError.message}`);
            }
        } catch (error) {
            console.error("Error Details:", {
                message: error.message,
                type: error.constructor.name,
                stack: error.stack
            });

            const errorMessage = error.message.includes("NFT not found") 
                ? "NFT not found - Please check if the NFT name is correct"
                : error.message.includes("connect MetaMask")
                ? "Please connect your MetaMask wallet first"
                : `Error: ${error.message}`;

            if (action === 'register') {
                setRegistrationResult({ error: errorMessage });
                setVerificationResult(null);
            } else {
                setVerificationResult({ error: errorMessage });
                setRegistrationResult(null);
            }
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.cardBox}>
                <h1 style={styles.title}>NFT Registration & Verification</h1>

                <button onClick={connectWallet} style={styles.walletButton}>
                    {account ? `Connected: ${account.slice(0, 6)}...${account.slice(-4)}` : "Connect MetaMask"}
                </button>
                
                {/* Test UI button removed */}

                <div style={styles.actionButtonsContainer}>
                    <label style={styles.actionLabel}>Action:</label>
                    <button
                        onClick={() => setAction("register")}
                        style={action === "register" ? styles.activeButton : styles.inactiveButton}
                    >
                        Register
                    </button>
                    <button
                        onClick={() => setAction("verify")}
                        style={action === "verify" ? styles.activeButton : styles.inactiveButton}
                    >
                        Verify
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <label style={styles.label}>NFT Name:</label>
                    <input
                        type="text"
                        value={nftName}
                        onChange={(e) => setNftName(e.target.value)}
                        style={styles.input}
                        required
                    />

                    {/* Contract details for both registration and verification */}
                    <label style={styles.label}>Contract Address {action === "register" ? "(recommended for source verification)" : "(optional)"}:</label>
                    <input
                        type="text"
                        name="contractAddress"
                        style={styles.input}
                        placeholder="0x..."
                    />
                    
                    <label style={styles.label}>Token ID {action === "register" ? "(recommended for source verification)" : "(optional)"}:</label>
                    <input
                        type="text"
                        name="tokenId"
                        style={styles.input}
                        placeholder="1"
                    />
                    
                    <label style={styles.label}>Owner Address {action === "register" ? "(for ownership verification)" : "(optional)"}:</label>
                    <input
                        type="text"
                        name="ownerAddress"
                        style={styles.input}
                        placeholder="0x..."
                        defaultValue={action === "register" ? account : ""}
                    />

                    <label style={styles.label}>Upload NFT Image:</label>
                    <input type="file" onChange={handleFileChange} style={styles.input} required />

                    <button type="submit" style={styles.submitButton}>
                        {action === "register" ? "Register NFT" : "Verify NFT"}
                    </button>
                </form>

                {registrationResult && (
                    <div style={styles.resultBox}>
                        <h3 style={styles.resultTitle}>Registration Result</h3>
                        {registrationResult.error ? (
                            <p style={styles.errorMessage}>{registrationResult.error}</p>
                        ) : (
                            <div>
                                <p style={styles.successMessage}>{registrationResult.message}</p>
                                <div style={styles.detailsContainer}>
                                    <p>Transaction Hash: {registrationResult.txHash}</p>
                                    <p>NFT Name: {registrationResult.details.name}</p>
                                    <p>pHash: {registrationResult.details.pHash}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Enhanced verification result display */}
                {/* Debug info removed */}
                
                {verificationResult && (
                    <div style={styles.resultBox}>
                        <h2 style={styles.resultTitle}>Verification Result</h2>
                        <div style={styles.detailsContainer}>
                            {verificationResult.error ? (
                                <p style={styles.errorMessage}>{verificationResult.error}</p>
                            ) : (
                                <div>
                                    {/* Final Result - Most Important */}
                                    <div style={{
                                        ...styles.finalConclusion,
                                        backgroundColor: verificationResult.finalResult.includes("AUTHENTIC") ? "#38a169" : 
                                                      verificationResult.finalResult.includes("SUSPICIOUS") ? "#dd6b20" : "#e53e3e",
                                        marginBottom: "20px"
                                    }}>
                                        <p style={{ fontSize: "1.2em", fontWeight: "bold", color: "white" }}>{verificationResult.finalResult}</p>
                                    </div>
                                    
                                    {/* Key Verification Metrics */}
                                    <div style={styles.verificationSection}>
                                        <div style={styles.sectionTitle}>Verification Summary</div>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                                            <div style={styles.metricBox}>
                                                <div style={styles.metricLabel}>Ownership</div>
                                                <div style={{
                                                    ...styles.metricValue,
                                                    backgroundColor: verificationResult.ownershipVerified ? "#38a169" : "#e53e3e"
                                                }}>
                                                    {verificationResult.ownershipVerified ? "✓ VERIFIED" : "✗ FAILED"}
                                                </div>
                                            </div>
                                            
                                            <div style={styles.metricBox}>
                                                <div style={styles.metricLabel}>pHash Match</div>
                                                <div style={{
                                                    ...styles.metricValue,
                                                    backgroundColor: verificationResult.phashMatch ? "#38a169" : "#e53e3e"
                                                }}>
                                                    {verificationResult.phashMatch ? "✓ MATCH" : "✗ MISMATCH"}
                                                </div>
                                            </div>
                                            
                                            <div style={styles.metricBox}>
                                                <div style={styles.metricLabel}>Source Image</div>
                                                <div style={{
                                                    ...styles.metricValue,
                                                    backgroundColor: verificationResult.sourceImageMatch ? "#38a169" : "#e53e3e"
                                                }}>
                                                    {verificationResult.sourceImageMatch ? "✓ MATCH" : "✗ MISMATCH"}
                                                </div>
                                            </div>
                                            
                                            <div style={styles.metricBox}>
                                                <div style={styles.metricLabel}>AI Similarity</div>
                                                <div style={{
                                                    ...styles.metricValue,
                                                    backgroundColor: verificationResult.cosineSimilarity >= 0.8 ? "#38a169" : 
                                                                  verificationResult.cosineSimilarity >= 0.5 ? "#dd6b20" : "#e53e3e"
                                                }}>
                                                    {(verificationResult.cosineSimilarity * 100).toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Detailed Metrics section removed */}
                                    
                                    {/* Ownership Information section removed */}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    container: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(120deg, #89f7fe 0%, #66a6ff 100%)", // gradient background
       
        color: "white",
    },
    metricBox: {
        display: "flex",
        flexDirection: "column",
        flex: "1 0 45%",
        minWidth: "120px",
        borderRadius: "8px",
        overflow: "hidden",
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
    },
    metricLabel: {
        backgroundColor: "#1a202c",
        padding: "8px",
        textAlign: "center",
        fontWeight: "bold",
        fontSize: "0.9em"
    },
    metricValue: {
        padding: "10px",
        textAlign: "center",
        fontWeight: "bold",
        color: "white"
    },
    detailItem: {
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: "1px solid #2d3748"
    },
    detailLabel: {
        fontWeight: "bold",
        color: "#a0aec0"
    },
    detailValue: {
        color: "#e2e8f0"
    },
    cardBox: {
        backgroundColor: "#3c366b",
        padding: "30px",
        borderRadius: "20px",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
        width: "90%",
        maxWidth: "500px",
        border: "2px solid #ffffff33", // subtle border
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
    },
    title: {
        fontSize: "24px",
        fontWeight: "bold",
        marginBottom: "20px",
    },
    walletButton: {
        backgroundColor: "#3182ce",
        padding: "10px 20px",
        borderRadius: "8px",
        marginBottom: "20px",
        cursor: "pointer",
        color: "white",
        border: "none",
    },
    actionButtonsContainer: {
        marginBottom: "20px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
    },
    actionLabel: {
        marginRight: "10px",
        color: "white",
    },
    activeButton: {
        backgroundColor: "#38a169",
        padding: "10px 20px",
        borderRadius: "8px",
        cursor: "pointer",
        color: "white",
        border: "none",
    },
    inactiveButton: {
        backgroundColor: "#4a5568",
        padding: "10px 20px",
        borderRadius: "8px",
        cursor: "pointer",
        color: "white",
        border: "none",
    },
    form: {
        backgroundColor: "#2d3748",
        padding: "20px",
        borderRadius: "8px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        width: "100%",
        marginBottom: "20px",
    },
    label: {
        display: "block",
        marginBottom: "10px",
        color: "white",
    },
    input: {
        width: "475px",
        padding: "10px",
        marginBottom: "20px",
        backgroundColor: "#edf2f7",
        borderRadius: "8px",
        border: "1px solid #ccc",
        color:"black",
    },
    submitButton: {
        width: "100%",
        padding: "12px",
        backgroundColor: "#3182ce",
        color: "white",
        borderRadius: "8px",
        cursor: "pointer",
        border: "none",
    },
    resultBox: {
        marginTop: "20px",
        color: "white",
        border: "3px solid #ffffff33",
        borderRadius: "15px",
        padding: "20px",
        width: "100%",
        backgroundColor: "#2d3748",
        boxShadow: "0 4px 15px rgba(0, 0, 0, 0.2)",
    },
    resultTitle: {
        textAlign: "center",
        marginBottom: "15px",
        color: "#38b2ac",
        fontSize: "1.5em",
        borderBottom: "2px solid #38b2ac33",
        paddingBottom: "10px",
    },
    verificationSection: {
        marginTop: "15px",
        padding: "15px",
        backgroundColor: "#1a202c",
        borderRadius: "10px",
        marginBottom: "15px",
    },
    sectionTitle: {
        color: "#38b2ac",
        marginBottom: "10px",
        fontSize: "1.2em",
    },
    detailsContainer: {
        marginTop: "15px",
        color: "#a0aec0",
        backgroundColor: "#1a202c",
        padding: "15px",
        borderRadius: "10px",
        wordBreak: "break-all",
    },
    successMessage: {
        color: "#48bb78",
        textAlign: "center",
        marginBottom: "15px",
        fontSize: "1.1em",
    },
    errorMessage: {
        color: "#f56565",
        textAlign: "center",
        fontSize: "1.1em",
    },
    finalConclusion: {
        marginTop: "20px",
        padding: "15px",
        backgroundColor: "#2c5282",
        borderRadius: "10px",
        textAlign: "center",
    },
};

export default App;
