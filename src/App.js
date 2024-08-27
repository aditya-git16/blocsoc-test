import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io('http://10.194.28.172:5001');

export default function BlockchainConsensusUI() {
  const [nodeId, setNodeId] = useState(null);
  const [chainLength, setChainLength] = useState(0);
  const [reputation, setReputation] = useState(0);
  const [availableTransactions, setAvailableTransactions] = useState([]);
  const [proposedBlock, setProposedBlock] = useState(null);
  const [roundInfo, setRoundInfo] = useState({ round: 0 });
  const [hasVoted, setHasVoted] = useState(false);
  const [isProposer, setIsProposer] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (!nodeId) {
      const newNodeId = Math.random().toString(36).substr(2, 9);
      setNodeId(newNodeId);
      fetch('/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: newNodeId })
      })
      .then(res => res.json())
      .then(data => {
        setChainLength(data.current_chain_length);
        setReputation(data.reputation);
      });
    }

    socket.on('round_start', (data) => {
      setRoundInfo({ round: data.round });
      setAvailableTransactions(data.available_transactions);
      setChainLength(data.current_chain_length);
      setIsProposer(data.proposer === nodeId);
      setProposedBlock(null);
      setHasVoted(false);
      setIsOnline(Math.random() < 0.95); // 95% chance of being online
    });

    socket.on('new_block_proposal', (data) => {
      setProposedBlock({
        proposer: data.proposer,
        hash: data.block_hash,
        transactions: data.transactions
      });
    });

    socket.on('round_end', (data) => {
      if (data.winning_block) {
        setChainLength(data.new_chain_length);
        setRoundInfo(prev => ({
          ...prev,
          winner: data.winning_block.proposer,
          winningTransactions: data.winning_block.transactions
        }));
      } else {
        setRoundInfo(prev => ({ ...prev, error: data.error }));
      }
    });

    socket.on('reputation_update', (data) => {
      if (data[nodeId]) {
        setReputation(data[nodeId]);
      }
    });

    return () => {
      socket.off('round_start');
      socket.off('new_block_proposal');
      socket.off('round_end');
      socket.off('reputation_update');
    };
  }, [nodeId]);

  const proposeBlock = () => {
    if (isOnline && isProposer) {
      const selectedTransactions = availableTransactions.slice(0, 5);
      socket.emit('propose_block', {
        node_id: nodeId,
        transactions: selectedTransactions,
        previous_hash: 'previous_hash_would_be_here_in_real_implementation'
      });
    }
  };

  const voteOnBlock = () => {
    if (isOnline && proposedBlock) {
      socket.emit('vote_on_block', {
        node_id: nodeId,
        block_hash: proposedBlock.hash
      });
      setHasVoted(true);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Improved Reputation-Based Blockchain Consensus Demo</h1>
      <p>Your Node ID: {nodeId}</p>
      <p>Current Round: {roundInfo.round}</p>
      <p>Current Blockchain Length: {chainLength}</p>
      <p>Your Reputation: {reputation.toFixed(2)}</p>
      <p>Online Status: {isOnline ? 'Online' : 'Offline'}</p>
      
      {isOnline ? (
        <>
          <div className="my-4">
            <h2 className="text-xl font-semibold">Available Transactions:</h2>
            <ul>
              {availableTransactions.map((tx, index) => (
                <li key={index}>{tx}</li>
              ))}
            </ul>
          </div>
          
          {isProposer && !proposedBlock && (
            <button onClick={proposeBlock} className="bg-blue-500 text-white px-4 py-2 mr-2">Propose Block</button>
          )}
          
          {proposedBlock && (
            <div className="my-4">
              <h2 className="text-xl font-semibold">Proposed Block:</h2>
              <p>Proposer: {proposedBlock.proposer}</p>
              <p>Transactions: {proposedBlock.transactions.join(', ')}</p>
              {!hasVoted && (
                <button onClick={voteOnBlock} className="bg-green-500 text-white px-4 py-2">
                  Vote for this Block
                </button>
              )}
              {hasVoted && <p>You have voted for this block.</p>}
            </div>
          )}
        </>
      ) : (
        <p className="text-red-500">You are currently offline and cannot participate in this round.</p>
      )}
      
      {roundInfo.winner && (
        <div className="my-4">
          <h2 className="text-xl font-semibold">Round Result:</h2>
          <p>Winning Proposer: {roundInfo.winner}</p>
          <p>Winning Transactions: {roundInfo.winningTransactions.join(', ')}</p>
        </div>
      )}
      
      {roundInfo.error && (
        <div className="my-4 text-red-500">
          <p>Error: {roundInfo.error}</p>
        </div>
      )}
    </div>
  );
}